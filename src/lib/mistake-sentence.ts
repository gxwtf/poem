// 默写错题本的句子校验（纯函数，服务端使用）
//
// 审核规则：
// 1. 只保留汉字/字母/数字参与比对，忽略标点与空白；
// 2. 至少 3 字，且必须能在站内古诗文正文中连续找到；
// 3. 允许一句里包含多个分句/句末标点，但文字必须连续，不能跳过原文。

export interface PoemSource {
    id: string
    title: string
    version: string
    author: string | null
    dynasty: string | null
    content: string
}

export interface SentenceMatch {
    ok: true
    /** 规范展示句：取诗文原文标点，末尾按原文或用户输入补全 */
    text: string
    /** 去标点后的句子，用于查重 */
    normalized: string
    poem: PoemSource
    score: number
}

export type SentenceRejectReason = "empty" | "too_short" | "too_long" | "not_sentence" | "not_found"

export interface SentenceRejection {
    ok: false
    reason: SentenceRejectReason
    normalized: string
}

export const MIN_SENTENCE_CHARS = 3
export const MAX_SENTENCE_CHARS = 200
export const MAX_IMPORT_LINES = 2000

const CONTENT_CHAR = /[\p{L}\p{N}]/u
// 同一个字的两种 Unicode 写法（「巘」的扩展区字形），只做字形归一，不做错字容错
const CHAR_VARIANTS = new Map([["𪩘", "巘"]])

function normalizeChar(ch: string): string {
    return CHAR_VARIANTS.get(ch) ?? ch
}

// 可用于断句的字符：句末/句中标点、引号书名号等；顿号（、）属于句内并列，不算断句
const BOUNDARY = new Set(Array.from("，。；：！？#、“”‘’《》〈〉【】（）()…— \t\r\n"))
const TERMINAL = new Set(Array.from("。！？…"))

function isBoundary(ch: string | undefined): boolean {
    if (ch === undefined) return true
    return BOUNDARY.has(ch) || /\s/.test(ch)
}

/** 去掉标点、空白，只保留文字与数字；同一个字的扩展区写法做归一 */
export function normalizeSentence(input: string): string {
    return Array.from(input)
        .filter((ch) => CONTENT_CHAR.test(ch))
        .map(normalizeChar)
        .join("")
}

/** 句子的有效字数（按 Unicode 字符计） */
export function sentenceLength(input: string): number {
    return Array.from(normalizeSentence(input)).length
}

interface IndexedSegment {
    poem: PoemSource
    chars: string[]
    /** 仅文字/数字拼成的字符串 */
    norm: string
    /** norm 中每个 UTF-16 单元对应的 chars 下标 */
    map: number[]
}

/**
 * 预先按“行”（# 分隔）切分所有诗文，构建检索索引。
 * 一次导入只构建一次，避免逐句重复扫描原文。
 */
export function buildSentenceIndex(poems: PoemSource[]): IndexedSegment[] {
    const segments: IndexedSegment[] = []
    for (const poem of poems) {
        for (const raw of poem.content.split("#")) {
            const chars = raw.split("")
            let norm = ""
            const map: number[] = []
            let offset = 0
            for (const ch of raw) {
                if (CONTENT_CHAR.test(ch)) {
                    norm += ch
                    for (let k = 0; k < ch.length; k++) map.push(offset + k)
                }
                offset += ch.length
            }
            if (norm) segments.push({ poem, chars, norm, map })
        }
    }
    return segments
}

/** 校验并匹配一个句子 */
export function validateSentence(
    input: string,
    index: IndexedSegment[]
): SentenceMatch | SentenceRejection {
    const raw = input.trim()
    if (!raw) return { ok: false, reason: "empty", normalized: "" }

    const normalized = normalizeSentence(raw)
    const length = Array.from(normalized).length
    if (length < MIN_SENTENCE_CHARS) return { ok: false, reason: "too_short", normalized }
    if (length > MAX_SENTENCE_CHARS) return { ok: false, reason: "too_long", normalized }

    // 用户自己写的句末标点；原文有句末标点时以原文为准
    const lastChar = Array.from(raw).pop() ?? ""
    const userTerminal = TERMINAL.has(lastChar) ? lastChar : ""

    let coreFound = false
    let best: SentenceMatch | null = null

    for (const segment of index) {
        if (!segment.norm.includes(normalized)) continue
        coreFound = true

        let from = 0
        while (true) {
            const at = segment.norm.indexOf(normalized, from)
            if (at === -1) break
            from = at + 1

            const start = segment.map[at]
            const end = segment.map[at + normalized.length - 1]
            const before = start > 0 ? segment.chars[start - 1] : undefined
            const after = end + 1 < segment.chars.length ? segment.chars[end + 1] : undefined
            if (!isBoundary(before) || !isBoundary(after)) continue

            const snippet = segment.chars.slice(start, end + 1).join("")
            const terminal = after && TERMINAL.has(after) ? after : userTerminal
            const text = snippet + terminal
            const score =
                (after && TERMINAL.has(after) ? 2 : 0) +
                (segment.poem.version === "senior" ? 1 : 0)

            if (!best || score > best.score) {
                best = { ok: true, text, normalized, poem: segment.poem, score }
            }
        }
    }

    if (best) return best
    return { ok: false, reason: coreFound ? "not_sentence" : "not_found", normalized }
}

export const REJECTION_MESSAGES: Record<SentenceRejectReason, string> = {
    empty: "空行",
    too_short: `字数过少（至少 ${MIN_SENTENCE_CHARS} 字）`,
    too_long: `句子过长（最多 ${MAX_SENTENCE_CHARS} 字）`,
    not_sentence: "不是完整句子（需从分句开头到分句结尾）",
    not_found: "未在站内古诗文中找到",
}
