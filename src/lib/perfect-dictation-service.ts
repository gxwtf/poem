// 完胜默写：服务端选题、打卡与遗忘曲线逻辑

import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { normalizeSentence } from "@/lib/mistake-sentence"
import {
    DEFAULT_DAILY_COUNT,
    DICTATION_RECITE_TAG,
    LEADERBOARD_ANONYMOUS_NAME,
    LEADERBOARD_HINTS,
    LEADERBOARD_LABELS,
    LEADERBOARD_MAX_ROWS,
    MIXED_MISTAKE_RATIO,
    RECENT_NEW_DAYS,
    SEMESTER_LABELS,
    booksForVersion,
    buildCloze,
    clampDailyCount,
    computeStreak,
    currentSemester,
    dayKey,
    defaultBooksFor,
    dictationWeight,
    gradeLabel,
    isPracticeMode,
    isPracticeResult,
    nextReviewUpdate,
    shiftDayKey,
    weekdayLabel,
    type BookOption,
    type CompleteGroupResponse,
    type CompleteQuestionResult,
    type DictationScope,
    type GroupResponse,
    type LeaderboardEntry,
    type LeaderboardResponse,
    type LeaderboardType,
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

function normalizeSettings(row: {
    dailyCount: number
    mode: string
    books: string[]
}): PerfectDictationSettings {
    return {
        dailyCount: clampDailyCount(row.dailyCount),
        mode: isPracticeMode(row.mode) ? row.mode : "mixed",
        books: Array.isArray(row.books) ? row.books : [],
    }
}

export async function getOrCreateSettings(userId: number): Promise<PerfectDictationSettings> {
    const row = await prisma.perfectDictationSetting.upsert({
        where: { userId },
        update: {},
        create: { userId, dailyCount: DEFAULT_DAILY_COUNT, mode: "mixed", books: [] },
    })
    return normalizeSettings(row)
}

export async function updateSettings(
    userId: number,
    patch: { dailyCount?: unknown; mode?: unknown; books?: unknown },
    version: string = "senior"
): Promise<PerfectDictationSettings> {
    const current = await getOrCreateSettings(userId)
    const dailyCount =
        typeof patch.dailyCount === "number" ? clampDailyCount(patch.dailyCount) : current.dailyCount
    const mode = isPracticeMode(patch.mode) ? patch.mode : current.mode

    let books = current.books
    if (Array.isArray(patch.books)) {
        // 只接受当前学段真实存在的册次，并按教材顺序去重排序；空数组表示「跟随年级默认」
        const allowed = booksForVersion(version)
        const picked = new Set(
            patch.books.filter((book): book is string => typeof book === "string")
        )
        books = allowed.filter((book) => picked.has(book))
    }

    const row = await prisma.perfectDictationSetting.upsert({
        where: { userId },
        update: { dailyCount, mode, books },
        create: { userId, dailyCount, mode, books },
    })
    return normalizeSettings(row)
}

/**
 * 解析本次出题范围：
 * - 默认册次由「年级 + 当前学期」推出（高一上=必修上，高二上=选必上+选必中，高三=不限…）；
 * - 用户在「完胜默写」里自选过册次则用自选（空数组仍按默认）。
 */
export async function resolveScope(params: {
    userId: number
    version: string
    grade: number
    now?: Date
}): Promise<DictationScope> {
    const { userId, version } = params
    const grade = typeof params.grade === "number" ? params.grade : 0
    const semester = currentSemester(params.now ?? new Date())
    const allowed = booksForVersion(version)

    const [settings, poems] = await Promise.all([
        getOrCreateSettings(userId),
        prisma.poem.findMany({ where: { version }, select: { tags: true } }),
    ])

    // 该学段是否已有「背默」标注；没有标注时（如初中数据尚未标注）不启用该过滤
    const reciteTagged = poems.some((poem) => poem.tags.includes(DICTATION_RECITE_TAG))

    const counts = new Map<string, number>(allowed.map((book) => [book, 0]))
    for (const poem of poems) {
        if (reciteTagged && !poem.tags.includes(DICTATION_RECITE_TAG)) continue
        for (const tag of new Set(poem.tags)) {
            const current = counts.get(tag)
            if (current === undefined) continue
            counts.set(tag, current + 1)
        }
    }
    const books: BookOption[] = allowed.map((key) => ({ key, count: counts.get(key) ?? 0 }))

    const customBooks = settings.books.filter((book) => allowed.includes(book))
    const defaultBooks = defaultBooksFor(grade, semester, version)
    const effectiveBooks = customBooks.length > 0 ? customBooks : defaultBooks

    return {
        version,
        grade,
        gradeLabel: gradeLabel(grade),
        semester,
        semesterLabel: SEMESTER_LABELS[semester],
        defaultBooks,
        customBooks,
        effectiveBooks,
        books,
        reciteTagged,
    }
}

async function getHomeBase(
    userId: number
): Promise<Omit<PerfectDictationHome, "scope">> {
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

export async function getHomeState(
    userId: number,
    params: { version: string; grade: number; now?: Date }
): Promise<PerfectDictationHome> {
    const [base, scope] = await Promise.all([
        getHomeBase(userId),
        resolveScope({
            userId,
            version: params.version,
            grade: params.grade,
            now: params.now,
        }),
    ])
    return { ...base, scope }
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
    grade: number,
    books: string[] | null,
    reciteTagged: boolean
): Promise<NewCandidate[]> {
    const since = new Date(Date.now() - RECENT_NEW_DAYS * 86_400_000)

    // 新句只从「默写整理」里抽取带「背默」标签、且属于用户已学册次的篇目
    const poemFilters: Prisma.PoemWhereInput[] = []
    if (reciteTagged) poemFilters.push({ tags: { has: DICTATION_RECITE_TAG } })
    if (books && books.length > 0) poemFilters.push({ tags: { hasSome: books } })

    const [poems, dictations, mistakes, states, recentAnswers] = await Promise.all([
        prisma.poem.findMany({
            where: poemFilters.length > 0 ? { version, AND: poemFilters } : { version },
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
    /** 生效册次；null 表示不限册次（高三 / 年级未知） */
    books: string[] | null
    /** 该学段是否启用「背默」标签过滤 */
    reciteTagged: boolean
}): Promise<GroupResponse> {
    const { userId, mode, version, grade, books, reciteTagged } = params
    const count = clampDailyCount(params.count)
    const selected: Candidate[] = []

    if (mode !== "new") {
        const mistakes = await loadMistakeCandidates(userId)
        const target = mode === "mixed" ? Math.round(count * MIXED_MISTAKE_RATIO) : count
        const picked = takeMistakes(mistakes, target, mode === "mistakes", selected)
        selected.push(...picked)
    }

    if (mode !== "mistakes") {
        const newCandidates = await loadNewCandidates(userId, version, grade, books, reciteTagged)
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
        const newCandidates = await loadNewCandidates(userId, version, grade, books, reciteTagged)
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

    const home = await getHomeBase(userId)
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

// ---------------- 排行榜 ----------------

/**
 * 两个榜都基于「完胜默写打卡」= 当天完成过至少一组（perfect_dictation_groups 里有一天）。
 * - total  积跬榜：累计打卡天数
 * - streak 勤学榜：当前连续打卡天数（中断则归零，不上榜）
 */
export async function getLeaderboard(params: {
    type: LeaderboardType
    viewerId?: number | null
    now?: Date
}): Promise<LeaderboardResponse> {
    const { type } = params
    const viewerId = params.viewerId ?? null
    const now = params.now ?? new Date()
    const today = dayKey(now)

    // 每人每天的打卡记录（数据库侧去重，避免行数膨胀）
    const grouped = await prisma.perfectDictationGroup.groupBy({
        by: ["userId", "day"],
        _count: { _all: true },
    })

    const daysByUser = new Map<number, string[]>()
    for (const row of grouped) {
        const list = daysByUser.get(row.userId)
        if (list) list.push(row.day)
        else daysByUser.set(row.userId, [row.day])
    }

    const scored = [...daysByUser.entries()].map(([userId, days]) => {
        const sorted = [...days].sort()
        return {
            userId,
            score: type === "streak" ? computeStreak(sorted, today) : sorted.length,
            firstDay: sorted[0] ?? "",
            lastDay: sorted[sorted.length - 1] ?? "",
        }
    })

    // 连续榜里断签（0 天）的人不上榜
    const ranked = scored
        .filter((item) => item.score > 0)
        .sort(
            (a, b) =>
                b.score - a.score ||
                a.firstDay.localeCompare(b.firstDay) ||
                b.lastDay.localeCompare(a.lastDay) ||
                a.userId - b.userId
        )

    const users = await prisma.user.findMany({
        where: { id: { in: ranked.map((item) => item.userId) } },
        select: { id: true, name: true },
    })
    const nameById = new Map(users.map((user) => [user.id, user.name?.trim() || ""]))

    const entries: LeaderboardEntry[] = ranked.map((item) => ({
        userId: item.userId,
        name: nameById.get(item.userId) || LEADERBOARD_ANONYMOUS_NAME,
        score: item.score,
        isMe: viewerId !== null && item.userId === viewerId,
    }))

    const myIndex = viewerId === null ? -1 : ranked.findIndex((item) => item.userId === viewerId)

    return {
        type,
        label: LEADERBOARD_LABELS[type],
        hint: LEADERBOARD_HINTS[type],
        unit: "天",
        rank: entries.slice(0, LEADERBOARD_MAX_ROWS),
        me: myIndex >= 0 ? { rank: myIndex + 1, score: ranked[myIndex].score } : null,
        totalParticipants: ranked.length,
        generatedAt: now.toISOString(),
    }
}

/** 登录时把广学账号的昵称同步到本地，排行榜用；名字没变就不写库 */
export async function syncUserName(
    userId: number,
    name: string | null | undefined
): Promise<void> {
    const trimmed = (name ?? "").trim()
    if (!trimmed) return
    try {
        await prisma.user.updateMany({
            where: { id: userId, OR: [{ name: null }, { name: { not: trimmed } }] },
            data: { name: trimmed },
        })
    } catch (error) {
        // 名字同步失败不能影响登录/出题主流程
        console.error("Error syncing user name:", error)
    }
}
