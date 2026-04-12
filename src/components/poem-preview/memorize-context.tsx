/*
此文件定义了一个 Context 和一个 Context Provider，用于设置阅读模式/背诵模式。
其中，memorize 的值为 NaN，表示当前处于阅读模式；值为实数时，表示处于背诵模式，且 memorize 的值代表背诵的难度。
更多信息可以参考：https://yuanbao.tencent.com/bot/app/share/chat/9Nrl3oZXWLuh

Author: wchengk09
*/

"use client";

import React, { createContext, useState } from "react";

// memorize: number
// - NaN: 阅读模式
// - 正数 (0-1]: 背诵模式，表示隐藏概率
// - -1: 首字提示模式（只显示每小句首字）
export type MemorizeType = number;

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
