/*
 * 背诵模式的站内字母键盘（26 键）
 *
 * 为什么不做「判断设备是否触屏、自动弹出系统键盘」：软键盘在 iOS 上 keydown 会给
 * "Unidentified"、中文输入法还会把字母吃掉，行为不可控。改成一个用户自己声明的入口——
 * 右下角悬浮按钮，点了就出这套键盘，不判断设备，电脑上也能用。
 *
 * 交互约定：
 *   - 悬浮按钮只在背诵模式显示，点开后按钮消失、键盘面板出现；
 *   - 面板上「收起」按钮把键盘收掉，一切恢复原样（按钮重现、点正文重新生效）；
 *   - 面板上的字母键与物理键盘走同一套判定（use-memorize-reveal）；
 *   - 「提示」键放在第三行左侧，等于「露下一个字」，缺拼音的字只能靠它。
 */

"use client";

import { Keyboard, ChevronDown, Lightbulb } from "lucide-react";

/** 26 键的标准 QWERTY 排布 */
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** 单个字母键 */
function Key({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <button
            type="button"
            aria-label={label}
            // 按下就执行，避免手机端 click 的延迟与焦点跳动
            onPointerDown={(e) => { e.preventDefault(); onPress(); }}
            className="
                text-brand bg-brand-muted hover:bg-brand/15 active:bg-brand/25
                flex h-11 flex-1 items-center justify-center rounded-md
                text-base font-semibold uppercase
                touch-manipulation select-none
            "
        >
            {label}
        </button>
    );
}

/** 功能键（提示 / 收起） */
function FuncKey({
    icon,
    label,
    onPress,
    ariaLabel,
}: {
    icon: React.ReactNode
    label: string
    onPress: () => void
    ariaLabel: string
}) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            onPointerDown={(e) => { e.preventDefault(); onPress(); }}
            className="
                text-brand border-brand/40 hover:bg-brand/10 active:bg-brand/20
                flex h-11 flex-[1.7] items-center justify-center gap-1 rounded-md border
                text-xs font-medium touch-manipulation select-none
            "
        >
            {icon}
            {label}
        </button>
    );
}

export function MemorizeKeyboardPanel({
    onLetter,
    onHint,
    onClose,
}: {
    onLetter: (letter: string) => void
    onHint: () => void
    onClose: () => void
}) {
    return (
        <div
            role="group"
            aria-label="背诵字母键盘"
            className="
                bg-card/95 border-border fixed inset-x-0 bottom-0 z-40 border-t
                shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur-sm
            "
            style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
        >
            <div className="mx-auto flex w-full max-w-xl flex-col gap-1.5 px-2 pt-2">
                {ROWS.map((row, rowIndex) => (
                    <div key={row} className="flex gap-1.5">
                        {rowIndex === 2 && (
                            <FuncKey
                                icon={<Lightbulb className="w-4 h-4" />}
                                label="提示"
                                ariaLabel="提示：显示下一个字"
                                onPress={onHint}
                            />
                        )}
                        {row.split("").map((letter) => (
                            <Key key={letter} label={letter} onPress={() => onLetter(letter)} />
                        ))}
                        {rowIndex === 2 && (
                            <FuncKey
                                icon={<ChevronDown className="w-4 h-4" />}
                                label="收起"
                                ariaLabel="收起键盘"
                                onPress={onClose}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** 右下角悬浮按钮：打开站内字母键盘（只在背诵模式渲染，由父组件控制） */
export function MemorizeKeyboardFab({ onOpen }: { onOpen: () => void }) {
    return (
        <button
            type="button"
            aria-label="打开字母键盘"
            onClick={onOpen}
            style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            className="
                bg-destructive text-white fixed right-4 z-40 flex size-12 items-center
                justify-center rounded-full shadow-lg transition-transform active:scale-95
            "
        >
            <Keyboard className="w-6 h-6" />
        </button>
    );
}
