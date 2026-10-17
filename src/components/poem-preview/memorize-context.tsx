/*
此文件定义了一个 Context 和一个 Context Provider，用于设置阅读模式/背诵模式。
其中，memorize 的值为 NaN，表示当前处于阅读模式；值为实数时，表示处于背诵模式。

memorize 的取值约定：
- NaN：阅读模式
- (0, 1]：随机隐藏单字模式，值表示原文中每个字被隐藏的概率
- -1（MEMORIZE_FIRST_CHAR）：首字提示模式（只显示每小句首字）
- [-3, -2]：随机隐藏整句模式，隐藏概率 = -(memorize + 2) ∈ [0, 1]

更多信息可以参考：https://yuanbao.tencent.com/bot/app/share/chat/9Nrl3oZXWLuh

Author: wchengk09
*/

"use client";

import React, { createContext, useState } from "react";

export type MemorizeType = number;

/** 首字提示模式的标记值 */
export const MEMORIZE_FIRST_CHAR = -1;

/** 随机隐藏整句模式的基准值：难度为 0 时取该值，难度为 1 时取 -3 */
export const MEMORIZE_SENTENCE_BASE = -2;

/** 把任意数值收敛到 [0, 1]，NaN 视为 0 */
export function clamp01(value: number): number {
    if (isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

/** 是否处于背诵模式（阅读模式为 NaN） */
export function isMemorizeMode(memorize: MemorizeType): boolean {
    return !isNaN(memorize);
}

/** 是否是随机隐藏单字模式 */
export function isCharHideMode(memorize: MemorizeType): boolean {
    return !isNaN(memorize) && memorize > 0;
}

/** 是否是首字提示模式 */
export function isFirstCharMode(memorize: MemorizeType): boolean {
    return memorize === MEMORIZE_FIRST_CHAR;
}

/** 是否是随机隐藏整句模式 */
export function isSentenceHideMode(memorize: MemorizeType): boolean {
    return !isNaN(memorize) && memorize <= MEMORIZE_SENTENCE_BASE;
}

/** 由隐藏概率（0~1）得到随机隐藏整句模式的 memorize 取值 */
export function sentenceHideValue(difficulty: number): MemorizeType {
    return MEMORIZE_SENTENCE_BASE - clamp01(difficulty);
}

/** 由 memorize 取值反解随机隐藏整句模式的隐藏概率 */
export function sentenceHideDifficulty(memorize: MemorizeType): number {
    return clamp01(MEMORIZE_SENTENCE_BASE - memorize);
}

export const MemorizeContext = createContext<{
    memorize: MemorizeType;
    setMemorize: (memorize: MemorizeType) => void;
}>({
    memorize: NaN,
    setMemorize: (memorize: MemorizeType) => { if(memorize){} }
});

// 用法：const { memorize, setMemorize } = useContext(MemorizeContext);
// 前提是你必须在父组件中使用了下文的 MemorizeContextProvider

export function MemorizeContextProvider(props: { children: React.ReactNode }) {
    const [memorize, setMemorize] = useState<MemorizeType>(NaN);
    return (
        <MemorizeContext.Provider value={{ memorize, setMemorize }}>
            {props.children}
        </MemorizeContext.Provider>
    );
}
