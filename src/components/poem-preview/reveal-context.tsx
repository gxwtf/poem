/*
 * 背诵模式的「按首字母显示隐藏字」状态
 *
 * 电脑上输入「按阅读顺序第一个尚未显示的字」的拼音首字母时，该字要被显示出来。
 * 但隐藏是每个 Char 自己的局部状态（StrictMode 下也不该靠 DOM 硬改），
 * 所以把「已被键盘打开的字」放在这里，用字格在全文中的稳定编号 slot 记账，
 * Char 命中时就按「已看过答案」渲染。
 *
 * 换一种背诵方式（memorize 取值变化，等于重新掷骰）时清空，
 * 免得上一轮揭开的答案漏到下一轮。
 */

"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";

export type RevealContextValue = {
    /** 已被键盘输入首字母打开的字格编号 */
    revealed: ReadonlySet<string>
    /** 打开一个被键盘输入命中的字格 */
    reveal: (slot: string) => void
};

export const RevealContext = createContext<RevealContextValue>({
    revealed: new Set<string>(),
    reveal: () => { },
});

export function RevealContextProvider({
    memorize,
    children,
}: {
    /** 当前背诵方式取值；变化即视为重新开始一轮，清空已揭开的字 */
    memorize: number
    children: React.ReactNode
}) {
    const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set<string>());

    useEffect(() => {
        setRevealed(new Set<string>());
    }, [memorize]);

    const reveal = useCallback((slot: string) => {
        setRevealed((prev) => {
            if (prev.has(slot)) return prev;  // 同一个字重复命中不必重渲染
            const next = new Set(prev);
            next.add(slot);
            return next;
        });
    }, []);

    const value = useMemo(() => ({ revealed, reveal }), [revealed, reveal]);

    return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>;
}
