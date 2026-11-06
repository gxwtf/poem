// 完胜默写：纯函数与共享类型（客户端组件也会 import 这里的类型/常量）

import { MIN_SENTENCE_CHARS, normalizeSentence } from "@/lib/mistake-sentence"

export const PRACTICE_MODES = ["mistakes", "new", "mixed"] as const
export type PracticeMode = (typeof PRACTICE_MODES)[number]

export const PRACTICE_RESULTS = ["correct", "wrong", "not_yet", "too_easy"] as const
export type PracticeResult = (typeof PRACTICE_RESULTS)[number]

export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
    mistakes: "只考错题",
    new: "只考新句",
    mixed: "错题为主，新句为辅",
}

export const PRACTICE_RESULT_LABELS: Record<PracticeResult, string> = {
    correct: "正确",
    wrong: "错误",
    not_yet: "还没背",
    too_easy: "太简单",
}

export const DEFAULT_DAILY_COUNT = 10
export const MIN_DAILY_COUNT = 1
export const MAX_DAILY_COUNT = 50
export const MIXED_MISTAKE_RATIO = 0.7
export const RECENT_NEW_DAYS = 3
export const APP_TIME_ZONE = "Asia/Shanghai"

const DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
})

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
})

const CONTENT_CHAR = /[\p{L}\p{N}]/u
const TERMINALS = "。！？"
const CLOSERS = "”’」』》〉）】]"

/** 本地（Asia/Shanghai）日期键，例如 2026-11-05 */
export function dayKey(date: Date = new Date()): string {
    return DAY_FORMATTER.format(date)
}

/** 在日期键上前后移动若干天 */
export function shiftDayKey(key: string, delta: number): string {
    const d = new Date(`${key}T12:00:00+08:00`)
    d.setUTCDate(d.getUTCDate() + delta)
    return dayKey(d)
}

/** 连续打卡天数：今天还没打卡时从昨天开始算，避免当天尚未打卡就显示中断 */
export function computeStreak(days: string[], today: string = dayKey()): number {
    const set = new Set(days)
    let cursor = set.has(today) ? today : shiftDayKey(today, -1)
    let streak = 0
    while (set.has(cursor)) {
        streak++
        cursor = shiftDayKey(cursor, -1)
    }
    return streak
}

export function weekdayLabel(day: string): string {
    return WEEKDAY_FORMATTER.format(new Date(`${day}T12:00:00+08:00`))
}

export function isPracticeMode(value: unknown): value is PracticeMode {
    return typeof value === "string" && (PRACTICE_MODES as readonly string[]).includes(value)
}

export function isPracticeResult(value: unknown): value is PracticeResult {
    return typeof value === "string" && (PRACTICE_RESULTS as readonly string[]).includes(value)
}

export function clampDailyCount(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_DAILY_COUNT
    return Math.min(MAX_DAILY_COUNT, Math.max(MIN_DAILY_COUNT, Math.round(value)))
}

export function gradeLabel(grade: number | null | undefined): string | null {
    if (grade === 10) return "高一"
    if (grade === 11) return "高二"
    if (grade === 12) return "高三"
    return null
}

/**
 * 新句考察权重：真题出现频率（对数平滑） × 年级相关度。
 * 同年级 3 倍、相邻年级 1.5 倍、其他年级 1 倍；初中年级暂不区分年级。
 */
export function dictationWeight(
    frequency: number,
    appearances: { grade: string }[],
    grade: number | null | undefined
): number {
    const target = gradeLabel(grade)
    let factor = 1
    if (target && appearances.length > 0) {
        let exact = 0
        let adjacent = 0
        for (const a of appearances) {
            if (a.grade === target) exact++
            else if (
                (target === "高一" && a.grade === "高二") ||
                (target === "高二" && (a.grade === "高一" || a.grade === "高三")) ||
                (target === "高三" && a.grade === "高二")
            ) {
                adjacent++
            }
        }
        const other = appearances.length - exact - adjacent
        factor = (exact * 3 + adjacent * 1.5 + other) / appearances.length
    }
    return (1 + Math.log2(1 + Math.max(0, frequency))) * factor
}

// ---------------- 填空题生成 ----------------

export interface ClozePart {
    text: string
    blank?: boolean
}

export interface ClozeLine {
    kind: "context" | "blank" | "mixed"
    parts: ClozePart[]
}

export interface ClozeQuestion {
    /** 答案（完整句或空缺分句） */
    answer: string
    /** 去标点后的答案，用于查重/状态 */
    normalized: string
    /** 答案所在的完整原句 */
    sourceSentence: string
    /** 是否整句都作为空缺（整句时展示相邻一句作为上下文） */
    whole: boolean
    lines: ClozeLine[]
}

interface SentenceInfo {
    text: string
    normalized: string
    map: number[]
}

function makeSentence(text: string): SentenceInfo {
    let normalized = ""
    const map: number[] = []
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (CONTENT_CHAR.test(ch)) {
            normalized += ch
            map.push(i)
        }
    }
    return { text, normalized, map }
}

/** 按句末标点和 # 分行，把诗文切成句子（保留标点） */
export function splitPoemSentences(content: string): string[] {
    const sentences: string[] = []
    for (const raw of content.split("#")) {
        const segment = raw.trim()
        if (!segment) continue
        let start = 0
        for (let i = 0; i < segment.length; i++) {
            if (!TERMINALS.includes(segment[i])) continue
            let end = i + 1
            while (end < segment.length && CLOSERS.includes(segment[end])) end++
            const sentence = segment.slice(start, end).trim()
            if (sentence) sentences.push(sentence)
            start = end
            i = end - 1
        }
        const tail = segment.slice(start).trim()
        if (tail) sentences.push(tail)
    }
    return sentences
}

interface Located {
    index: number
    sentence: SentenceInfo
    start: number
    end: number
    canonical: string
    whole: boolean
}

function locateTarget(sentences: SentenceInfo[], targetNormalized: string): Located | null {
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i]
        const at = sentence.normalized.indexOf(targetNormalized)
        if (at === -1) continue
        const start = sentence.map[at]
        const end = sentence.map[at + targetNormalized.length - 1] + 1
        return {
            index: i,
            sentence,
            start,
            end,
            canonical: sentence.text.slice(start, end),
            whole: sentence.normalized === targetNormalized,
        }
    }
    return null
}


/** 去掉成不了对的半边引号（整对引号仍在同段文字里时保留） */
const QUOTE_PAIRS: [string, string][] = [
    ["“", "”"],
    ["‘", "’"],
    ["「", "」"],
    ["『", "』"],
]

function stripUnpairedQuotes(text: string): string {
    if (!text) return text
    const chars = Array.from(text)
    const remove = new Set<number>()
    for (const [open, close] of QUOTE_PAIRS) {
        const stack: number[] = []
        chars.forEach((char, index) => {
            if (char === open) stack.push(index)
            else if (char === close) {
                if (stack.length > 0) stack.pop()
                else remove.add(index)
            }
        })
        for (const index of stack) remove.add(index)
    }
    if (remove.size === 0) return text
    return chars.filter((_, index) => !remove.has(index)).join("")
}

function blankPattern(text: string): string {
    // 每个连续的文字片段替换成一段下划线，保留标点
    return text.replace(/[\p{L}\p{N}]+/gu, "____")
}

function splitPattern(pattern: string): ClozePart[] {
    const parts: ClozePart[] = []
    let i = 0
    while (i < pattern.length) {
        if (pattern.startsWith("____", i)) {
            parts.push({ text: "____", blank: true })
            i += 4
        } else {
            let j = i
            while (j < pattern.length && !pattern.startsWith("____", j)) j++
            parts.push({ text: pattern.slice(i, j) })
            i = j
        }
    }
    return parts
}


/** 长句挖空时只保留答案附近的一个分句作为上下文，避免整段铺满屏幕 */
function trimBeforeContext(text: string): string {
    if (text.length <= 24) return text
    const trimmed = text.replace(/[；。]$/, "")
    const index = trimmed.lastIndexOf("；")
    return index >= 0 ? text.slice(index + 1) : text
}

function trimAfterContext(text: string): string {
    if (text.length <= 24) return text
    const lead = text.startsWith("；") ? "；" : ""
    const body = lead ? text.slice(1) : text
    const index = body.indexOf("；")
    return lead + (index >= 0 ? body.slice(0, index + 1) : body)
}

interface ContextPick {
    sentence: SentenceInfo
    /** 上下文句相对答案句的位置：before = 原诗里在答案之前，after = 在答案之后 */
    position: "before" | "after"
}

function pickContext(
    sentences: SentenceInfo[],
    index: number,
    targetNormalized: string,
    avoidContext?: Set<string>
): ContextPick | null {
    const options: ContextPick[] = []
    const prev = sentences[index - 1]
    const next = sentences[index + 1]
    const forbidden = avoidContext ? [...avoidContext] : []
    const leaks = (sentence: SentenceInfo) =>
        forbidden.some((normalized) => sentence.normalized.includes(normalized))
    if (
        prev &&
        prev.text.length <= 50 &&
        !prev.normalized.includes(targetNormalized) &&
        !leaks(prev)
    ) {
        options.push({ sentence: prev, position: "before" })
    }
    if (
        next &&
        next.text.length <= 50 &&
        !next.normalized.includes(targetNormalized) &&
        !leaks(next)
    ) {
        options.push({ sentence: next, position: "after" })
    }
    if (options.length === 0) return null
    return options[Math.floor(Math.random() * options.length)]
}

/**
 * 由诗文原文和答案生成填空题：
 * - 答案是整句：随机展示前/后一句作为上下文，整句挖空；
 * - 答案是半句/短语：展示答案所在原句，只挖掉答案部分。
 */
export function buildCloze(
    content: string,
    targetText: string,
    avoidContext?: Set<string>
): ClozeQuestion | null {
    const targetNormalized = normalizeSentence(targetText)
    if (Array.from(targetNormalized).length < MIN_SENTENCE_CHARS) return null

    const sentences = splitPoemSentences(content)
        .map(makeSentence)
        .filter((s) => s.normalized.length > 0)
    if (sentences.length === 0) return null

    const located = locateTarget(sentences, targetNormalized)
    if (!located) return null

    const rawAnswer = located.whole ? located.sentence.text : located.canonical
    const answer = stripUnpairedQuotes(rawAnswer)
    const pattern = blankPattern(stripUnpairedQuotes(rawAnswer))

    if (located.whole) {
        const context = pickContext(sentences, located.index, targetNormalized, avoidContext)
        const blankLine: ClozeLine = { kind: "blank", parts: splitPattern(pattern) }
        // 上下文必须按它在原诗里的真实位置摆放：
        // 前一句放上面、后一句放下面，否则会出现「后一句显示在空格之前」的倒错
        const contextLine = (pick: ContextPick): ClozeLine => ({
            kind: "context",
            parts: [{ text: stripUnpairedQuotes(pick.sentence.text) }],
        })
        const lines: ClozeLine[] = context
            ? context.position === "before"
                ? [contextLine(context), blankLine]
                : [blankLine, contextLine(context)]
            : [blankLine]
        return {
            answer,
            normalized: targetNormalized,
            sourceSentence: stripUnpairedQuotes(located.sentence.text),
            whole: true,
            lines,
        }
    }

    const before = stripUnpairedQuotes(
        trimBeforeContext(located.sentence.text.slice(0, located.start))
    )
    const after = stripUnpairedQuotes(
        trimAfterContext(located.sentence.text.slice(located.end))
    )
    const parts: ClozePart[] = []
    if (before) parts.push({ text: before })
    parts.push(...splitPattern(pattern))
    if (after) parts.push({ text: after })

    return {
        answer,
        normalized: targetNormalized,
        sourceSentence: stripUnpairedQuotes(located.sentence.text),
        whole: false,
        lines: [{ kind: "mixed", parts }],
    }
}

// ---------------- 遗忘曲线 ----------------

export interface ReviewSnapshot {
    repetitions: number
    intervalDays: number
    easeFactor: number
    lapses: number
}

export interface ReviewUpdate extends ReviewSnapshot {
    status: "active"
    dueAt: Date
    lastReviewedAt: Date
}

/** 正确：1 天 → 3 天 → 间隔 × 难度系数；错误：重置并当天到期 */
export function nextReviewUpdate(
    prev: ReviewSnapshot | null,
    result: "correct" | "wrong",
    now: Date = new Date()
): ReviewUpdate {
    if (result === "wrong") {
        return {
            repetitions: 0,
            intervalDays: 0,
            easeFactor: Math.max(1.3, (prev?.easeFactor ?? 2.5) - 0.2),
            lapses: (prev?.lapses ?? 0) + 1,
            status: "active",
            dueAt: now,
            lastReviewedAt: now,
        }
    }

    const repetitions = (prev?.repetitions ?? 0) + 1
    const previousEase = prev?.easeFactor ?? 2.5
    const easeFactor = Math.min(2.8, previousEase + 0.1)
    const intervalDays =
        repetitions === 1
            ? 1
            : repetitions === 2
              ? 3
              : Math.max(1, Math.round((prev?.intervalDays || 1) * previousEase))
    return {
        repetitions,
        intervalDays,
        easeFactor,
        lapses: prev?.lapses ?? 0,
        status: "active",
        dueAt: new Date(now.getTime() + intervalDays * 86_400_000),
        lastReviewedAt: now,
    }
}

// ---------------- 书目范围（只考量「已学过」的「背默」篇目） ----------------

/** 人教统编高中教材册次，也是诗文 tags 里的册次标记 */
export const SENIOR_BOOKS = ["必修上", "必修下", "选必上", "选必中", "选必下"] as const
/** 初中教材册次标记 */
export const JUNIOR_BOOKS = ["七上", "七下", "八上", "八下", "九上", "九下"] as const

export type Semester = "first" | "second"

export const SEMESTER_LABELS: Record<Semester, string> = {
    first: "上学期",
    second: "下学期",
}

/** 「背默」标签：只有带这个 tag 的篇目才作为完胜默写的题库 */
export const DICTATION_RECITE_TAG = "背默"

export function booksForVersion(version: string): string[] {
    return version === "junior" ? [...JUNIOR_BOOKS] : [...SENIOR_BOOKS]
}

/** 判断某个册次是否属于该学段（用于入参校验，避免把「七上」写进高中设置里） */
export function isBookKey(version: string, value: unknown): value is string {
    return typeof value === "string" && booksForVersion(version).includes(value)
}

/**
 * 当前学期判断，与「古诗文推荐」（src/app/api/recommends/route.ts）保持一致：
 * 9 月 1 日及以后 ~ 次年 2 月算上学期，3 ~ 8 月算下学期。
 */
export function currentSemester(now: Date = new Date()): Semester {
    const month = now.getMonth() + 1
    const day = now.getDate()
    if (month > 9 || (month === 9 && day >= 1)) return "first"
    if (month <= 2) return "first"
    return "second"
}

/**
 * 按年级 + 学期推出「已经学过」的册次：
 * - 高一上：必修上；高一下：必修下
 * - 高二上：选必上 + 选必中；高二下：选必中 + 选必下
 * - 高三：不限（返回 null）
 * - 初中同构：七上/七下、八上/八下、九上/九下
 * - 年级未知（0/null）或超出范围：不限（返回 null）
 */
export function defaultBooksFor(
    grade: number | null | undefined,
    semester: Semester,
    version: string = "senior"
): string[] | null {
    const g = typeof grade === "number" ? grade : 0
    const first = semester === "first"

    if (version === "junior") {
        switch (g) {
            case 7:
                return [first ? "七上" : "七下"]
            case 8:
                return [first ? "八上" : "八下"]
            case 9:
                return [first ? "九上" : "九下"]
            default:
                return null
        }
    }

    switch (g) {
        case 10:
            return [first ? "必修上" : "必修下"]
        case 11:
            return first ? ["选必上", "选必中"] : ["选必中", "选必下"]
        case 12:
            return null // 高三：全部
        default:
            return null
    }
}

export interface BookOption {
    key: string
    /** 该册里可用于默写的篇目数（含「背默」标记的篇目） */
    count: number
}

export interface DictationScope {
    version: string
    grade: number
    gradeLabel: string | null
    semester: Semester
    semesterLabel: string
    /** 年级 + 学期推出的默认册次；null 表示不限（高三 / 年级未知） */
    defaultBooks: string[] | null
    /** 用户在「完胜默写」里自选并保存的册次；空数组表示仍用默认 */
    customBooks: string[]
    /** 实际生效的册次；null 表示不限 */
    effectiveBooks: string[] | null
    /** 当前学段可选的全部册次及各自可用篇目数 */
    books: BookOption[]
    /** 该学段是否已有「背默」标注过的篇目（没有标注时按未启用该过滤处理） */
    reciteTagged: boolean
}

// ---------------- API / UI 共享类型 ----------------

export interface PerfectDictationSettings {
    dailyCount: number
    mode: PracticeMode
    /** 用户自选册次；空数组 = 跟随年级默认 */
    books: string[]
}

export interface PerfectDictationWeekDay {
    day: string
    weekday: string
    checked: boolean
}

export interface PerfectDictationHome {
    settings: PerfectDictationSettings
    streak: number
    checkedInToday: boolean
    todayGroups: number
    todayQuestions: number
    dueMistakes: number
    mistakeCount: number
    week: PerfectDictationWeekDay[]
    /** 本次出题范围（年级默认 / 用户自选） */
    scope: DictationScope
}

export interface PracticeQuestion {
    poemId: string
    title: string
    author: string | null
    dynasty: string | null
    version: string
    pool: "mistake" | "new"
    answer: string
    normalized: string
    sourceSentence: string
    lines: ClozeLine[]
}

export interface GroupResponse {
    mode: PracticeMode
    count: number
    questions: PracticeQuestion[]
    /** 本组实际使用的出题范围 */
    scope?: DictationScope
}

export interface CompleteQuestionResult {
    poemId: string
    text: string
    pool: "mistake" | "new"
    result: PracticeResult
}

export interface CompleteGroupResponse {
    total: number
    correct: number
    wrong: number
    notYet: number
    tooEasy: number
    streak: number
    checkedInToday: boolean
    todayGroups: number
}
