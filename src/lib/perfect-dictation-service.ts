// 完胜默写：服务端选题、打卡与遗忘曲线逻辑

import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { normalizeSentence } from "@/lib/mistake-sentence"
import {
    DEFAULT_DAILY_COUNT,
    MIXED_MISTAKE_RATIO,
    RECENT_NEW_DAYS,
    buildCloze,
    clampDailyCount,
    computeStreak,
    dayKey,
    dictationWeight,
    isPracticeMode,
    isPracticeResult,
    nextReviewUpdate,
    shiftDayKey,
    weekdayLabel,
    type CompleteGroupResponse,
    type CompleteQuestionResult,
    type GroupResponse,
    type PerfectDictationHome,
    type PerfectDictationSettings,
    type PracticeMode,
    type PracticeQuestion,
    type ReviewSnapshot,
} from "@/lib/perfect-dictation"

interface PoemRow {
    id: string
    title: string
    version: string
    author: string | null
    dynasty: string | null
    content: string
}

interface Candidate {
    poem: PoemRow
    /** 使用诗文原文中的文本重新生成答案 */
    targetText: string
    normalized: string
    sourceNormalized: string
    sentenceKey: string
    pool: "mistake" | "new"
}

interface MistakeCandidate extends Candidate {
    due: boolean
    dueAt: Date
    lapses: number
}

interface NewCandidate extends Candidate {
    weight: number
}

export class InvalidPracticeResultError extends Error {}

function normalizeSettings(row: { dailyCount: number; mode: string }): PerfectDictationSettings {
    return {
        dailyCount: clampDailyCount(row.dailyCount),
        mode: isPracticeMode(row.mode) ? row.mode : "mixed",
    }
}

export async function getOrCreateSettings(userId: number): Promise<PerfectDictationSettings> {
    const row = await prisma.perfectDictationSetting.upsert({
        where: { userId },
        update: {},
        create: { userId, dailyCount: DEFAULT_DAILY_COUNT, mode: "mixed" },
    })
    return normalizeSettings(row)
}

export async function updateSettings(
    userId: number,
    patch: { dailyCount?: unknown; mode?: unknown }
): Promise<PerfectDictationSettings> {
    const current = await getOrCreateSettings(userId)
    const dailyCount =
        typeof patch.dailyCount === "number" ? clampDailyCount(patch.dailyCount) : current.dailyCount
    const mode = isPracticeMode(patch.mode) ? patch.mode : current.mode
    const row = await prisma.perfectDictationSetting.upsert({
        where: { userId },
        update: { dailyCount, mode },
        create: { userId, dailyCount, mode },
    })
    return normalizeSettings(row)
}

export async function getHomeState(userId: number): Promise<PerfectDictationHome> {
    const today = dayKey()
    const [settings, groups, mistakes, states] = await Promise.all([
        getOrCreateSettings(userId),
        prisma.perfectDictationGroup.findMany({
            where: { userId },
            select: { day: true, total: true },
            orderBy: { day: "desc" },
            take: 1000,
        }),
        prisma.dictationMistake.findMany({ where: { userId }, select: { normalized: true } }),
        prisma.dictationReviewState.findMany({
            where: { userId },
            select: { normalized: true, status: true, dueAt: true },
        }),
    ])

    const now = new Date()
    const stateMap = new Map(states.map((s) => [s.normalized, s]))
    const dueMistakes = mistakes.filter((m) => {
        const state = stateMap.get(m.normalized)
        if (state?.status === "excluded") return false
        return !state || state.dueAt <= now
    }).length

    const days = [...new Set(groups.map((g) => g.day))]
    const todayGroups = groups.filter((g) => g.day === today)
    const weekDays = Array.from({ length: 7 }, (_, i) => shiftDayKey(today, i - 6))
    const daySet = new Set(days)

    return {
        settings,
        streak: computeStreak(days, today),
        checkedInToday: todayGroups.length > 0,
        todayGroups: todayGroups.length,
        todayQuestions: todayGroups.reduce((sum, g) => sum + g.total, 0),
        dueMistakes,
        mistakeCount: mistakes.length,
        week: weekDays.map((day) => ({
            day,
            weekday: weekdayLabel(day),
            checked: daySet.has(day),
        })),
    }
}

async function loadMistakeCandidates(userId: number): Promise<MistakeCandidate[]> {
    const [mistakes, states] = await Promise.all([
        prisma.dictationMistake.findMany({
            where: { userId },
            include: {
                poem: {
                    select: {
                        id: true,
                        title: true,
                        version: true,
                        author: true,
                        dynasty: true,
                        content: true,
                    },
                },
            },
        }),
        prisma.dictationReviewState.findMany({ where: { userId } }),
    ])

    const stateMap = new Map(states.map((s) => [s.normalized, s]))
    const now = new Date()
    const out: MistakeCandidate[] = []

    for (const mistake of mistakes) {
        const state = stateMap.get(mistake.normalized)
        if (state?.status === "excluded") continue

        const cloze = buildCloze(mistake.poem.content, mistake.text)
        if (!cloze) continue

        out.push({
            poem: mistake.poem,
            targetText: mistake.text,
            normalized: cloze.normalized,
            sourceNormalized: normalizeSentence(cloze.sourceSentence),
            sentenceKey: `${mistake.poem.id}:${normalizeSentence(cloze.sourceSentence)}`,
            pool: "mistake",
            due: !state || state.dueAt <= now,
            dueAt: state?.dueAt ?? new Date(0),
            lapses: state?.lapses ?? 0,
        })
    }

    // 到期优先；同等到期时间时随机（先 shuffle 再稳定排序）
    shuffle(out)
    out.sort(
        (a, b) =>
            Number(b.due) - Number(a.due) ||
            a.dueAt.getTime() - b.dueAt.getTime() ||
            b.lapses - a.lapses
    )
    return out
}

async function loadNewCandidates(
    userId: number,
    version: string,
    grade: number
): Promise<NewCandidate[]> {
    const since = new Date(Date.now() - RECENT_NEW_DAYS * 86_400_000)
    const [poems, dictations, mistakes, states, recentAnswers] = await Promise.all([
        prisma.poem.findMany({
            where: { version },
            select: {
                id: true,
                title: true,
                version: true,
                author: true,
                dynasty: true,
                content: true,
            },
        }),
        prisma.dictation.findMany({
            where: { poemTitle: { not: null } },
            select: {
                content: true,
                revised: true,
                poemTitle: true,
                poemVersion: true,
                appearances: { select: { grade: true } },
            },
        }),
        prisma.dictationMistake.findMany({ where: { userId }, select: { normalized: true } }),
        prisma.dictationReviewState.findMany({ where: { userId }, select: { normalized: true } }),
        prisma.perfectDictationAnswer.findMany({
            where: { userId, createdAt: { gte: since } },
            select: { normalized: true },
        }),
    ])

    const blocked = new Set<string>()
    for (const mistake of mistakes) blocked.add(mistake.normalized)
    for (const state of states) blocked.add(state.normalized)
    for (const answer of recentAnswers) blocked.add(answer.normalized)

    const poemByTitle = new Map(poems.map((p) => [p.title, p]))

    interface Merged {
        poem: PoemRow
        targetText: string
        normalized: string
        sourceNormalized: string
        frequency: number
        appearances: { grade: string }[]
    }

    const merged = new Map<string, Merged>()

    for (const dictation of dictations) {
        if (!dictation.poemTitle) continue
        if (dictation.poemVersion && dictation.poemVersion !== version) continue
        const poem = poemByTitle.get(dictation.poemTitle.trim())
        if (!poem) continue

        const texts = [dictation.revised?.trim(), dictation.content?.trim()].filter(
            (t): t is string => !!t
        )

        for (const text of texts) {
            const cloze = buildCloze(poem.content, text)
            if (!cloze) continue
            if (blocked.has(cloze.normalized)) break

            const existing = merged.get(cloze.normalized)
            if (existing) {
                existing.frequency += dictation.appearances.length
                existing.appearances.push(...dictation.appearances)
            } else {
                merged.set(cloze.normalized, {
                    poem,
                    targetText: text,
                    normalized: cloze.normalized,
                    sourceNormalized: normalizeSentence(cloze.sourceSentence),
                    frequency: dictation.appearances.length,
                    appearances: [...dictation.appearances],
                })
            }
            break
        }
    }

    return [...merged.values()].map((item) => ({
        poem: item.poem,
        targetText: item.targetText,
        normalized: item.normalized,
        sourceNormalized: item.sourceNormalized,
        sentenceKey: `${item.poem.id}:${item.sourceNormalized}`,
        pool: "new",
        weight: dictationWeight(item.frequency, item.appearances, grade),
    }))
}

function overlaps(a: string, b: string): boolean {
    return a === b || a.includes(b) || b.includes(a)
}

function conflicts(candidate: Candidate, selected: Candidate[]): boolean {
    return selected.some(
        (item) =>
            item.sentenceKey === candidate.sentenceKey ||
            overlaps(item.normalized, candidate.normalized)
    )
}

function takeMistakes(
    candidates: MistakeCandidate[],
    count: number,
    allowUpcoming: boolean,
    selected: Candidate[]
): MistakeCandidate[] {
    if (count <= 0) return []
    const picked: MistakeCandidate[] = []
    for (const candidate of candidates) {
        if (picked.length >= count) break
        if (!allowUpcoming && !candidate.due) continue
        if (conflicts(candidate, selected) || conflicts(candidate, picked)) continue
        picked.push(candidate)
    }
    return picked
}

function takeNew(
    candidates: NewCandidate[],
    count: number,
    selected: Candidate[]
): NewCandidate[] {
    if (count <= 0) return []
    const available = [...candidates]
    const picked: NewCandidate[] = []
    const blocked = [...selected]

    while (picked.length < count && available.length > 0) {
        const viable = available.filter((c) => !conflicts(c, blocked))
        if (viable.length === 0) break

        const total = viable.reduce((sum, c) => sum + c.weight, 0)
        let roll = Math.random() * total
        let index = 0
        for (; index < viable.length; index++) {
            roll -= viable[index].weight
            if (roll <= 0) break
        }
        if (index >= viable.length) index = viable.length - 1

        const chosen = viable[index]
        available.splice(available.indexOf(chosen), 1)
        picked.push(chosen)
        blocked.push(chosen)
    }

    return picked
}

function shuffle<T>(list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
}

export async function generatePracticeGroup(params: {
    userId: number
    mode: PracticeMode
    count: number
    version: string
    grade: number
}): Promise<GroupResponse> {
    const { userId, mode, version, grade } = params
    const count = clampDailyCount(params.count)
    const selected: Candidate[] = []

    if (mode !== "new") {
        const mistakes = await loadMistakeCandidates(userId)
        const target = mode === "mixed" ? Math.round(count * MIXED_MISTAKE_RATIO) : count
        const picked = takeMistakes(mistakes, target, mode === "mistakes", selected)
        selected.push(...picked)
    }

    if (mode !== "mistakes") {
        const newCandidates = await loadNewCandidates(userId, version, grade)
        const picked = takeNew(newCandidates, count - selected.length, selected)
        selected.push(...picked)
    }

    // 一组里错题不够时用新句补；新句不够时用未到期错题补
    if (selected.length < count && mode !== "new") {
        const mistakes = await loadMistakeCandidates(userId)
        const picked = takeMistakes(mistakes, count - selected.length, true, selected)
        selected.push(...picked)
    }
    if (selected.length < count && mode !== "mistakes") {
        const newCandidates = await loadNewCandidates(userId, version, grade)
        const picked = takeNew(newCandidates, count - selected.length, selected)
        selected.push(...picked)
    }

    const allNormalized = selected.map((item) => item.normalized)
    const allSource = selected.map((item) => item.sourceNormalized)
    const questions: PracticeQuestion[] = []
    for (const item of selected) {
        const avoid = new Set(
            [...allNormalized, ...allSource].filter(
                (normalized) =>
                    normalized !== item.normalized && normalized !== item.sourceNormalized
            )
        )
        const cloze = buildCloze(item.poem.content, item.targetText, avoid)
        if (!cloze) continue
        questions.push({
            poemId: item.poem.id,
            title: item.poem.title,
            author: item.poem.author,
            dynasty: item.poem.dynasty,
            version: item.poem.version,
            pool: item.pool,
            answer: cloze.answer,
            normalized: cloze.normalized,
            sourceSentence: cloze.sourceSentence,
            lines: cloze.lines,
        })
    }

    return { mode, count, questions: shuffle(questions) }
}

export async function completePracticeGroup(params: {
    userId: number
    mode: PracticeMode
    results: CompleteQuestionResult[]
    now?: Date
}): Promise<CompleteGroupResponse> {
    const { userId, mode } = params
    const now = params.now ?? new Date()

    if (!Array.isArray(params.results) || params.results.length === 0) {
        throw new InvalidPracticeResultError("没有作答记录")
    }
    if (params.results.length > 50) {
        throw new InvalidPracticeResultError("单组题目过多")
    }

    const poemIds = [...new Set(params.results.map((r) => r.poemId))]
    const poems = await prisma.poem.findMany({
        where: { id: { in: poemIds } },
        select: { id: true, content: true },
    })
    const poemMap = new Map(poems.map((p) => [p.id, p]))

    const checked: {
        poemId: string
        text: string
        normalized: string
        pool: "mistake" | "new"
        result: CompleteQuestionResult["result"]
    }[] = []

    for (const item of params.results) {
        if (!item || typeof item !== "object") {
            throw new InvalidPracticeResultError("作答内容不正确")
        }
        if (!isPracticeResult(item.result)) {
            throw new InvalidPracticeResultError("作答结果不正确")
        }
        if (item.pool !== "mistake" && item.pool !== "new") {
            throw new InvalidPracticeResultError("题目来源不正确")
        }
        if (typeof item.poemId !== "string" || typeof item.text !== "string") {
            throw new InvalidPracticeResultError("作答内容不正确")
        }
        const poem = poemMap.get(item.poemId)
        if (!poem) throw new InvalidPracticeResultError("题目对应的诗文不存在")
        const cloze = buildCloze(poem.content, item.text)
        if (!cloze) throw new InvalidPracticeResultError("题目内容与诗文不匹配")

        checked.push({
            poemId: item.poemId,
            text: cloze.answer,
            normalized: cloze.normalized,
            pool: item.pool,
            result: item.result,
        })
    }

    const normalizedList = [...new Set(checked.map((r) => r.normalized))]
    const existingStates = await prisma.dictationReviewState.findMany({
        where: { userId, normalized: { in: normalizedList } },
    })
    const stateMap = new Map(existingStates.map((s) => [s.normalized, s]))

    const correct = checked.filter((r) => r.result === "correct").length
    const wrong = checked.filter((r) => r.result === "wrong").length
    const notYet = checked.filter((r) => r.result === "not_yet").length
    const tooEasy = checked.filter((r) => r.result === "too_easy").length

    const groupId = randomUUID()
    const operations: Prisma.PrismaPromise<unknown>[] = [
        prisma.perfectDictationGroup.create({
            data: {
                id: groupId,
                userId,
                day: dayKey(now),
                mode,
                total: checked.length,
                correct,
                wrong,
                notYet,
                tooEasy,
                answers: {
                    create: checked.map((item) => ({
                        userId,
                        poemId: item.poemId,
                        text: item.text,
                        normalized: item.normalized,
                        pool: item.pool,
                        result: item.result,
                    })),
                },
            },
        }),
    ]

    for (const item of checked) {
        if (item.result === "not_yet") continue

        if (item.result === "wrong") {
            operations.push(
                prisma.dictationMistake.upsert({
                    where: {
                        userId_normalized: { userId, normalized: item.normalized },
                    },
                    create: {
                        userId,
                        poemId: item.poemId,
                        text: item.text,
                        normalized: item.normalized,
                    },
                    update: { poemId: item.poemId, text: item.text },
                })
            )
        }

        const previous = stateMap.get(item.normalized)
        const snapshot: ReviewSnapshot | null = previous
            ? {
                  repetitions: previous.repetitions,
                  intervalDays: previous.intervalDays,
                  easeFactor: previous.easeFactor,
                  lapses: previous.lapses,
              }
            : null

        if (item.result === "too_easy") {
            operations.push(
                prisma.dictationReviewState.upsert({
                    where: {
                        userId_normalized: { userId, normalized: item.normalized },
                    },
                    create: {
                        userId,
                        poemId: item.poemId,
                        text: item.text,
                        normalized: item.normalized,
                        status: "excluded",
                        dueAt: now,
                        lastReviewedAt: now,
                    },
                    update: {
                        poemId: item.poemId,
                        text: item.text,
                        status: "excluded",
                        lastReviewedAt: now,
                    },
                })
            )
            continue
        }

        const update = nextReviewUpdate(snapshot, item.result, now)
        operations.push(
            prisma.dictationReviewState.upsert({
                where: {
                    userId_normalized: { userId, normalized: item.normalized },
                },
                create: {
                    userId,
                    poemId: item.poemId,
                    text: item.text,
                    normalized: item.normalized,
                    status: update.status,
                    repetitions: update.repetitions,
                    intervalDays: update.intervalDays,
                    easeFactor: update.easeFactor,
                    lapses: update.lapses,
                    dueAt: update.dueAt,
                    lastReviewedAt: update.lastReviewedAt,
                },
                update: {
                    poemId: item.poemId,
                    text: item.text,
                    status: update.status,
                    repetitions: update.repetitions,
                    intervalDays: update.intervalDays,
                    easeFactor: update.easeFactor,
                    lapses: update.lapses,
                    dueAt: update.dueAt,
                    lastReviewedAt: update.lastReviewedAt,
                },
            })
        )
    }

    await prisma.$transaction(operations)

    const home = await getHomeState(userId)
    return {
        total: checked.length,
        correct,
        wrong,
        notYet,
        tooEasy,
        streak: home.streak,
        checkedInToday: home.checkedInToday,
        todayGroups: home.todayGroups,
    }
}
