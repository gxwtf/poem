/*
 * 背诵模式的「揭字」核心逻辑（键盘首字母 / 点击 / 站内字母键盘 三处共用）
 *
 * 规则（与需求一致）：
 *   - 只认「按阅读顺序第一个还没显示的字」，命中就显示它，目标顺延到下一个，**不跳字**；
 *   - 敲首字母：带声调的字按基础字母敲（ān 敲 a），ü 记作 v，见 lib/pinyin.ts；
 *     敲错了只抖一下，不显示答案；
 *   - 空白背诵模式（isNoHintMode）里标点跟着它后面的字一起露出，
 *     正文全部显示完时，文末剩下的标点也一起显示；
 *   - 提示 / 点击：直接露下一个字，不校验首字母（缺拼音的字只能这样露出）。
 *
 * 之所以从组件里抽出来：站内字母键盘（手机）和物理键盘必须走同一套判定，
 * 否则早晚会出现「敲键能过、点键盘过不了」这种分叉。
 */

"use client";

import { useCallback, useContext, useEffect, useRef } from "react";
import { isMemorizeMode, isNoHintMode, MemorizeContext } from "./memorize-context";
import { RevealContext } from "./reveal-context";

/** 处于隐藏状态的字格（空白模式下包含标点） */
const HIDDEN_SELECTOR = '[data-char][data-hidden="1"]';

/** pressLetter 的结果：命中 / 敲错 / 没有可揭的字 */
export type PressResult = "hit" | "miss" | "none";

/** 标点字格：空白模式下它们也隐藏，但它们不是「待背的字」 */
function isPunctCell(el: HTMLElement): boolean {
    return el.hasAttribute("data-punct");
}

/** 当前所有隐藏字格，DOM 顺序即阅读顺序 */
function hiddenCells(root: ParentNode): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(HIDDEN_SELECTOR));
}

/**
 * 下一个待显示的字：阅读顺序上第一个还隐藏着的正文字格（跳过标点）。
 *
 * @param requireInitial 是否要求该字有拼音首字母（物理键盘/字母键盘必须要求；
 *                提示与点击不依赖拼音，缺拼音的字也要能露出）
 * @param pending 同一帧里已经命中、但 React 还没提交渲染的字格，先跳过
 */
function findNextTarget(
    root: ParentNode,
    pending: ReadonlySet<string>,
    requireInitial: boolean,
): HTMLElement | null {
    for (const el of hiddenCells(root)) {
        if (isPunctCell(el)) continue;
        if (requireInitial && !el.dataset.initial) continue;
        const slot = el.dataset.charSlot;
        if (slot && pending.has(slot)) continue;
        return el;
    }
    return null;
}

/** 敲错时的轻微抖动；尊重系统的「减少动态效果」设置 */
function shake(el: HTMLElement) {
    if (typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
        [
            { transform: "translateX(0)" },
            { transform: "translateX(-0.12em)" },
            { transform: "translateX(0.12em)" },
            { transform: "translateX(0)" },
        ],
        { duration: 180, easing: "ease-in-out" },
    );
}

export function useMemorizeReveal(rootRef: React.RefObject<HTMLDivElement | null>) {
    const { memorize } = useContext(MemorizeContext);
    const { reveal, revealed } = useContext(RevealContext);
    // 已命中、但 DOM 还没更新的字格（同帧连打两个字时用）
    const pending = useRef<Set<string>>(new Set());

    // 每提交一次 reveal，对应字格的 data-hidden 就消失了，pending 使命结束
    useEffect(() => {
        pending.current.clear();
    }, [revealed]);

    /**
     * 显示一个正文字格；空白模式下连带它前面的连续标点一起显示。
     * @param stayVisible 站内键盘打开时要保证目标在可视区内（否则被键盘面板盖住）
     */
    const revealTarget = useCallback((root: HTMLElement, target: HTMLElement, stayVisible: boolean) => {
        const blankMode = isNoHintMode(memorize);
        const slots: string[] = [];
        const targetSlot = target.dataset.charSlot;
        if (targetSlot) slots.push(targetSlot);

        if (blankMode) {
            const cells = hiddenCells(root);
            const index = cells.indexOf(target);
            // 往前收连续标点（遇到正文或同帧刚揭开的格子就停）
            for (let i = index - 1; i >= 0; i--) {
                const el = cells[i];
                const slot = el.dataset.charSlot;
                if (!isPunctCell(el)) break;
                if (slot && pending.current.has(slot)) break;
                if (slot) slots.push(slot);
            }
            // 文末收尾：后面没有待显示的正文了，剩下的标点（句号、后引号）一起显示
            const shownNow = new Set([...pending.current, ...slots]);
            const hasMoreChars = cells.some(el => {
                const slot = el.dataset.charSlot ?? "";
                return !isPunctCell(el) && !shownNow.has(slot);
            });
            if (!hasMoreChars) {
                for (const el of cells) {
                    const slot = el.dataset.charSlot;
                    if (slot && !shownNow.has(slot)) slots.push(slot);
                }
            }
        }

        for (const slot of slots) {
            pending.current.add(slot);
            reveal(slot);
        }

        if (stayVisible) target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [memorize, reveal]);

    /**
     * 敲一个首字母：命中就露下一个字，没命中抖动，没有可揭的字返回 none。
     * 空白模式不跳字——缺拼音的字也是当前目标，敲任意字母都算过，避免卡在数据缺口上。
     */
    const pressLetter = useCallback((letter: string, stayVisible = false): PressResult => {
        const root = rootRef.current;
        if (!root || !isMemorizeMode(memorize)) return "none";
        const blankMode = isNoHintMode(memorize);

        const target = findNextTarget(root, pending.current, !blankMode);
        if (!target) return "none";

        const expected = target.dataset.initial;
        if (!expected || letter.toLowerCase() === expected) {
            revealTarget(root, target, stayVisible);
            return "hit";
        }
        // 空白模式下字格里只有不可见占位，抖那一格看不出来，改抖整段正文
        shake(blankMode ? (target.closest(".poem-text") ?? target) : target);
        return "miss";
    }, [memorize, revealTarget, rootRef]);

    /** 提示/点击：直接露下一个字（缺拼音的字也能露） */
    const revealNext = useCallback((stayVisible = false): boolean => {
        const root = rootRef.current;
        if (!root || !isMemorizeMode(memorize)) return false;
        const target = findNextTarget(root, pending.current, false);
        if (!target) return false;
        revealTarget(root, target, stayVisible);
        return true;
    }, [memorize, revealTarget, rootRef]);

    /** 是否还有没显示的字（用于「提示」键的禁用态） */
    const hasNext = useCallback((): boolean => {
        const root = rootRef.current;
        return !!root && !!findNextTarget(root, pending.current, false);
    }, [rootRef]);

    return { pressLetter, revealNext, hasNext };
}
