/*
 * 背诵模式的「逐个显示」输入：键盘敲首字母 + 鼠标点击
 *
 * 规则（与需求一致）：
 *   - 只认「按阅读顺序第一个还没显示的字」，命中就显示它，目标顺延到下一个，**不跳字**；
 *   - 键盘：首字母带声调时按基础字母敲（ān 敲 a），ü 记作 v（ǚ 敲 v），见 lib/pinyin.ts；
 *     敲错了只让该字格轻微抖一下，不显示答案、也不打断背诵；
 *   - 鼠标：空白背诵模式（isNoHintMode）里整篇连标点都是空白，点一下正文就露出下一个字；
 *     其它背诵模式里「点/划过某一格就显示这一格」由 Char 自己处理，这里不插手；
 *   - 空白背诵模式下标点跟着它后面的字一起露出（「问曰：“」这种，露出「问」时把前面的引号带上），
 *     正文全部显示完时，文末剩下的标点（句号、后引号）也一起显示；
 *   - 不是背诵模式、焦点在输入框里、或者按的是组合键（Ctrl/⌘/Alt）时一律不管。
 *
 * 为什么用 document 监听而不是给每个字格绑监听：字格是 div，本身不可聚焦，
 * 而且背诵时用户不会先点一下正文。这样也不用 6 万多个字格各挂一个监听。
 */

"use client";

import { useContext, useEffect, useRef } from "react";
import { isMemorizeMode, isNoHintMode, MemorizeContext } from "./memorize-context";
import { RevealContext } from "./reveal-context";
import { isLetterKey } from "@/lib/pinyin";

/** 处于隐藏状态的字格（背诵模式渲染出来的占位符，含空白模式下的标点） */
const HIDDEN_SELECTOR = '[data-char][data-hidden="1"]';

/** 点到这些元素时不当作「点击正文」：按钮、链接、输入框、弹层内容 */
const INTERACTIVE_SELECTOR =
    'button, a, input, textarea, select, label, [role="button"], [role="menuitem"], [role="dialog"], [data-slot="popover-content"], [data-slot="dialog-content"]';

/** 焦点在输入框/可编辑区域时，把按键还给它们自己（比如背诵弹层里的难度输入框） */
function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/** 标点字格（空白背诵模式下它们也是隐藏的，但它们不是「待背的字」） */
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
 * @param requireInitial 是否要求该字有拼音首字母（键盘必须要求，否则敲哪个键都不知道对不对；
 *                鼠标点击不依赖拼音，缺拼音的字也要能点开）。空白背诵模式不跳过任何字。
 * @param pending 已经在同一帧里命中、但 React 还没提交渲染的字格，先跳过它们。
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

export function MemorizeInput({ rootRef }: { rootRef: React.RefObject<HTMLDivElement | null> }) {
    const { memorize } = useContext(MemorizeContext);
    const { reveal, revealed } = useContext(RevealContext);
    // 已命中、但 DOM 还没更新的字格（见 findNextTarget 的说明）
    const pending = useRef<Set<string>>(new Set());

    // 每提交一次 reveal，对应字格的 data-hidden 就消失了，pending 使命结束
    useEffect(() => {
        pending.current.clear();
    }, [revealed]);

    /**
     * 显示一个正文字格；空白背诵模式下连带它前面的连续标点一起显示
     * （标点没有自己的「字」，只能跟着后面的字露出来，这样才不会出现「先露问号后露问」）。
     */
    function revealTarget(root: HTMLElement, target: HTMLElement) {
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
    }

    useEffect(() => {
        if (!isMemorizeMode(memorize)) return;
        const blankMode = isNoHintMode(memorize);

        function handleKeyDown(event: KeyboardEvent) {
            if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
            if (!isLetterKey(event.key)) return;
            if (isEditableTarget(event.target)) return;

            const root = rootRef.current;
            if (!root) return;

            // 空白背诵模式不跳字：缺拼音的字也是当前目标，敲任意字母都算过（否则会卡死在数据缺口上）
            const next = findNextTarget(root, pending.current, !blankMode);
            if (!next) return;

            // 背诵模式下这些字母已经被「敲首字母」占用：拦掉默认行为，
            // 否则 Firefox 会弹出「快速查找」，空格/翻页键之外也不再有别的副作用
            event.preventDefault();

            const expected = next.dataset.initial;
            if (!expected || event.key.toLowerCase() === expected) revealTarget(root, next);
            // 空白模式下字格里只有不可见占位，抖那一格看不出来，改抖整段正文
            else shake(blankMode ? (next.closest(".poem-text") ?? next) : next);
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [memorize, reveal, rootRef]);  // eslint-disable-line react-hooks/exhaustive-deps

    // 空白背诵模式：点一下正文就露出下一个字（其它模式里点某一格由 Char 自己揭开那一格）
    useEffect(() => {
        if (!isNoHintMode(memorize)) return;

        function handlePointerDown(event: PointerEvent) {
            if (event.button !== 0) return;  // 只认左键：右键/中键不揭字
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.closest(INTERACTIVE_SELECTOR)) return;  // 点按钮/弹层不算点正文

            const root = rootRef.current;
            if (!root || !root.contains(target)) return;

            const next = findNextTarget(root, pending.current, false);
            if (!next) return;
            revealTarget(root, next);
        }

        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [memorize, reveal, rootRef]);  // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}
