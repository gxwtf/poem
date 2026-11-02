/*
 * 背诵模式的输入装配：物理键盘 / 点正文 / 站内字母键盘 三个入口 + 悬浮按钮
 *
 * 判定与揭字统一交给 use-memorize-reveal（同一个 pending 集合，避免「键盘能过、点键盘过不了」）。
 * 这里只负责：
 *   - 物理键盘 keydown → pressLetter（不区分是否打开了站内键盘，电脑上照旧）；
 *   - 触屏/鼠标点正文 → revealNext（仅空白背诵模式，且站内键盘**未打开**时）；
 *     用 pointerup + 位移阈值判定，滚动/滑动不会被当成点击而误揭字；
 *   - 站内字母键盘：右下角悬浮按钮打开 → 面板出现、按钮消失；
 *     面板上的字母键/提示键走同一套判定；「收起」恢复原样；退出背诵自动收起。
 */

"use client";

import { useCallback, useContext, useEffect } from "react";
import { isMemorizeMode, isNoHintMode, MemorizeContext } from "./memorize-context";
import { isLetterKey } from "@/lib/pinyin";
import { useMemorizeReveal } from "./use-memorize-reveal";
import { MemorizeKeyboardFab, MemorizeKeyboardPanel } from "./memorize-letter-keyboard";

/** 点到这些元素时不当作「点击正文」：按钮、链接、输入框、弹层内容 */
const INTERACTIVE_SELECTOR =
    'button, a, input, textarea, select, label, [role="button"], [role="menuitem"], [role="dialog"], [data-slot="popover-content"], [data-slot="dialog-content"]';

/** 手指/鼠标位移超过这个像素数就算滑动，不算点击 */
const TAP_SLOP = 8;

/** 焦点在输入框/可编辑区域时，把按键还给它们自己（比如背诵弹层里的难度输入框） */
function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

export function MemorizeControls({
    rootRef,
    keyboardOpen,
    onOpenKeyboard,
    onCloseKeyboard,
}: {
    rootRef: React.RefObject<HTMLDivElement | null>
    /** 站内字母键盘是否打开（状态由 PoemPreview 持有，好让正文同步关掉点击） */
    keyboardOpen: boolean
    onOpenKeyboard: () => void
    onCloseKeyboard: () => void
}) {
    const { memorize } = useContext(MemorizeContext);
    const { pressLetter, revealNext } = useMemorizeReveal(rootRef);

    const memorizeMode = isMemorizeMode(memorize);
    const blankMode = isNoHintMode(memorize);

    // ---- 物理键盘 ----
    useEffect(() => {
        if (!memorizeMode) return;

        function handleKeyDown(event: KeyboardEvent) {
            if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
            if (!isLetterKey(event.key)) return;
            if (isEditableTarget(event.target)) return;

            // 有可揭的字才拦默认行为：否则 Firefox 会把字母键当成「快速查找」
            if (pressLetter(event.key, keyboardOpen) === "none") return;
            event.preventDefault();
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [memorizeMode, pressLetter, keyboardOpen]);

    // ---- 点正文（空白模式 + 站内键盘收起时）----
    useEffect(() => {
        if (!memorizeMode || !blankMode || keyboardOpen) return;

        let start: { x: number; y: number; id: number } | null = null;

        function handlePointerDown(event: PointerEvent) {
            if (event.button !== 0) return;  // 只认左键/单指
            start = { x: event.clientX, y: event.clientY, id: event.pointerId };
        }

        function handlePointerUp(event: PointerEvent) {
            const from = start;
            start = null;
            if (!from || from.id !== event.pointerId) return;
            // 滑动（滚动、划词）不算点击
            if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_SLOP) return;

            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.closest(INTERACTIVE_SELECTOR)) return;  // 点按钮/弹层不算点正文

            const root = rootRef.current;
            if (!root || !root.contains(target)) return;

            revealNext();
        }

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("pointerup", handlePointerUp);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("pointerup", handlePointerUp);
        };
    }, [memorizeMode, blankMode, keyboardOpen, revealNext, rootRef]);

    const handleLetterFromKeyboard = useCallback((letter: string) => {
        pressLetter(letter, true);   // 面板打开着：露字后把目标滚到可视区中间
    }, [pressLetter]);

    const handleHint = useCallback(() => {
        revealNext(true);
    }, [revealNext]);

    return (
        <>
            {memorizeMode && !keyboardOpen && (
                <MemorizeKeyboardFab onOpen={onOpenKeyboard} />
            )}
            {memorizeMode && keyboardOpen && (
                <MemorizeKeyboardPanel
                    onLetter={handleLetterFromKeyboard}
                    onHint={handleHint}
                    onClose={onCloseKeyboard}
                />
            )}
        </>
    );
}
