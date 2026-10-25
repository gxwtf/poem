/*
 * 古诗文文本工具
 *
 * 背诵模式中的「首字提示」与「随机隐藏整句」都依赖「以标点符号断句」这一套判断，
 * 这里集中实现，避免各处各写一份导致行为分歧。
 */

/**
 * 是否是标点符号（含换行）。
 * 分类细则集中在 lib/punctuation.ts（点号/开标号/闭标号/破折号/省略号/间隔号），
 * 这里保留导出名，供背诵模式判断断句与「首字」使用。
 */
import { isPunctuation } from "./punctuation";

export { isPunctuation };

/** 是否是空白字符（半角空格等）。空白字符既不断句也不隐藏 */
export function isBlank(char: string | undefined): boolean {
    return !!char && char.trim() === "";
}

/** 找出 index 之前第一个非空白字符；空白字符在断句时被忽略 */
function previousVisibleChar(chars: string[], index: number): string | undefined {
    for (let i = index - 1; i >= 0; i--) {
        if (!isBlank(chars[i])) return chars[i];
    }
    return undefined;
}

/**
 * chars[index] 是否为一个「句」（小句）的第一个字。
 * 规则：自身不是标点/空白，且它前面（忽略空白）没有字符或是一个标点。
 */
function isUnitStart(chars: string[], index: number): boolean {
    const char = chars[index];
    if (isPunctuation(char) || isBlank(char)) return false;
    const prev = previousVisibleChar(chars, index);
    return prev === undefined || isPunctuation(prev);
}

/**
 * 随机隐藏整句：以标点为界，整句（小句）一起隐藏。
 *
 * 返回与 chars 等长的掩码，true 表示该字需要隐藏；标点与空白永不隐藏。
 * 同一句内的所有字共享同一次随机结果，随机函数可注入以便测试。
 */
export function computeUnitHidingMask(
    chars: string[],
    difficulty: number,
    random: () => number = Math.random,
): boolean[] {
    const hidden: boolean[] = new Array(chars.length).fill(false);
    let currentHidden = false;
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        // 标点与空白始终显示，也不改变当前句的隐藏状态
        if (isPunctuation(char) || isBlank(char)) continue;
        if (isUnitStart(chars, i)) currentHidden = random() < difficulty;
        hidden[i] = currentHidden;
    }
    return hidden;
}
