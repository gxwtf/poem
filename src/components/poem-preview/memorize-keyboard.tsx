/*
 * 背诵模式的键盘输入：在电脑上输入「下一个隐藏字」拼音的首字母就能显示该字
 *
 * 规则（与需求一致）：
 *   - 只认「按阅读顺序第一个尚未显示的字」，敲对了就显示它，目标顺延到下一个；
 *   - 首字母带声调时按基础字母敲（ān 敲 a），ü 记作 v（ǚ 敲 v），见 lib/pinyin.ts；
 *   - 敲错了只让该字格轻微抖一下，不显示答案、也不打断背诵；
 *   - 不是背诵模式、焦点在输入框里、或者按的是组合键（Ctrl/⌘/Alt）时一律不管。
 *
 * 为什么用 document 监听而不是给每个字格绑 keydown：字格是 div，本身不可聚焦，
 * 而且背诵时用户不会先点一下正文。这样也不用 6 万多个字格各挂一个监听。
 */

"use client";

import { useContext, useEffect, useRef } from "react";
import { isMemorizeMode, MemorizeContext } from "./memorize-context";
import { RevealContext } from "./reveal-context";
import { isLetterKey } from "@/lib/pinyin";

/** 处于隐藏状态的字格（背诵模式渲染出来的占位符） */
const HIDDEN_SELECTOR = '[data-char][data-hidden="1"]';

/** 焦点在输入框/可编辑区域时，把按键还给它们自己（比如背诵弹层里的难度输入框） */
function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * 下一个待背的字格：DOM 顺序就是阅读顺序，第一个还隐藏着的字格即是目标。
 *
 * @param pending 已经敲对、但 React 还没提交渲染的字格编号。同一帧里连打两个正确
 *                首字母时，前一个字的 data-hidden 还在 DOM 上，不排除它就会把第二个键
 *                当成敲错；排除后才轮到下一个隐藏字。
 */
function findNextHidden(root: ParentNode, pending: ReadonlySet<string>): HTMLElement | null {
    for (const el of root.querySelectorAll<HTMLElement>(HIDDEN_SELECTOR)) {
        // 没有拼音的字（数据缺失）敲不出来，跳过它去找后面的字
        if (!el.dataset.initial) continue;
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

export function MemorizeKeyboard({ rootRef }: { rootRef: React.RefObject<HTMLDivElement | null> }) {
    const { memorize } = useContext(MemorizeContext);
    const { reveal, revealed } = useContext(RevealContext);
    // 已敲对、但 DOM 还没更新的字格（见 findNextHidden 的说明）
    const pending = useRef<Set<string>>(new Set());

    // 每提交一次 reveal，对应字格的 data-hidden 就消失了，pending 使命结束
    useEffect(() => {
        pending.current.clear();
    }, [revealed]);

    useEffect(() => {
        if (!isMemorizeMode(memorize)) return;

        function handleKeyDown(event: KeyboardEvent) {
            if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
            if (!isLetterKey(event.key)) return;
            if (isEditableTarget(event.target)) return;

            const root = rootRef.current;
            if (!root) return;

            const next = findNextHidden(root, pending.current);
            if (!next) return;

            // 背诵模式下这些字母已经被「敲首字母」占用：拦掉默认行为，
            // 否则 Firefox 会弹出「快速查找」，空格/翻页键之外也不再有别的副作用
            event.preventDefault();

            const slot = next.dataset.charSlot;
            if (!slot) return;
            if (event.key.toLowerCase() === next.dataset.initial) {
                pending.current.add(slot);
                reveal(slot);
            }
            else shake(next);
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [memorize, reveal, rootRef]);

    return null;
}
