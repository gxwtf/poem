// 古诗文汉字组件

"use client"

import { useState, useRef, useContext, useEffect } from "react";
import CharNote from "./char-note";
import {
    isCharHideMode,
    isFirstCharMode,
    isMemorizeMode,
    isSentenceHideMode,
    MemorizeContext,
} from "./memorize-context";
import { isBlank, isPunctuation } from "@/lib/poem-text";
import { MouseDownStatContext } from "../mouse-stat-context";

export type CharData = {
    char: string
    pinyin?: string
    note?: { title: string; content: string }[]
    frequency?: number
}

enum CharMode{
    Read = 0,
    Memorize = 1,
    ShowAnswer = 2,
    FirstChar = 3  // 首字提示模式：该字是首字，显示
}

export function Char({
    data,
    showPinyin,
    highlight,
    suppressNote,
    showNotes,
    isFirstChar,  // 是否是首字
    unitHidden = false  // 是否处于「被隐藏的整句」中（仅随机隐藏整句模式使用）
}: {
    data: CharData
    showPinyin: boolean
    highlight: boolean
    suppressNote?: (suppress: boolean) => void
    showNotes: boolean
    isFirstChar?: boolean
    unitHidden?: boolean
}) {
    const [showNote, setShowNote] = useState(false);
    const hoverTimer = useRef<number | null>(null);
    const { memorize } = useContext(MemorizeContext);
    const [ memorizeMode, setMemorizeMode ] = useState(CharMode.Read);
    const mouseDownStat = useContext(MouseDownStatContext);

    useEffect(() => {
        // 标点与空白不参与背诵：标点是断句依据，空白只是排版占位
        if (isPunctuation(data.char) || isBlank(data.char)) setMemorizeMode(CharMode.Read);
        else if (isFirstCharMode(memorize)) {
            // 首字提示模式：是首字就显示，否则隐藏
            setMemorizeMode(isFirstChar ? CharMode.FirstChar : CharMode.Memorize);
        }
        else if (isSentenceHideMode(memorize)) {
            // 随机隐藏整句模式：整句是否隐藏由父组件（Sentence）统一掷骰决定
            setMemorizeMode(unitHidden ? CharMode.Memorize : CharMode.Read);
        }
        else if (isCharHideMode(memorize)) setMemorizeMode(Math.random() < memorize ? CharMode.Memorize : CharMode.Read);
        else setMemorizeMode(CharMode.Read);
    }, [memorize, data.char, isFirstChar, unitHidden]);

    // useEffect(() => {
    //     console.log('ShowNotes:', showNotes);
    // }, [showNotes]);

    if (memorizeMode !== CharMode.Memorize){
        const clearHoverTimer = () => {
            if (hoverTimer.current !== null) {
                clearTimeout(hoverTimer.current);
                hoverTimer.current = null;
            }
        };

        const handleMouseEnter = () => {
            if (!showNotes) return; // 新增：隐藏注释时不触发
            clearHoverTimer();
            setShowNote(true);
            suppressNote?.(true);
        };

        const handleMouseLeave = () => {
            if (!showNotes) return; // 新增：隐藏注释时不触发
            clearHoverTimer();
            hoverTimer.current = window.setTimeout(() => {
                setShowNote(false);
                suppressNote?.(false);
            }, 200);
        };

        return (
            <div
                data-char={data.char}
                className={`
                    inline-block justify-center
                    ${memorizeMode === CharMode.Read || memorizeMode === CharMode.FirstChar ? "text-primary" : "text-[var(--theme-color)]"}
                    ${highlight ? "bg-yellow-100" : ""}
                    relative
                    ${isMemorizeMode(memorize) ? "select-none" : ""}
                `}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <span className="inline-flex flex-col items-center min-w-[1.5em] cursor-pointer">
                    {showPinyin && (
                        <span className="text-base text-gray-500 leading-none">{data.pinyin || ""}</span>
                    )}
                    {data.note && showNotes ? (
                        <CharNote
                            char={data.char}
                            pinyin={data.pinyin}
                            note={data.note}
                            frequency={data.frequency}
                        >
                            <strong>{data.char}</strong>
                        </CharNote>
                    ) : data.char}
                </span>
            </div>
        );
    }

    function handleMouseOver() {
        if (mouseDownStat && memorizeMode === CharMode.Memorize)
            setMemorizeMode(CharMode.ShowAnswer);
    }

    function handleMouseDown() {
        if (memorizeMode === CharMode.Memorize)
            setMemorizeMode(CharMode.ShowAnswer);
    }

    return (
        <div
            data-char={data.char}
            className={`inline-block justify-center text-primary ${highlight ? "bg-yellow-100" : ""} relative select-none`}
            onMouseOver={handleMouseOver}
            onMouseDown={handleMouseDown}
        >
            <span className="inline-flex flex-col items-center min-w-[1.5em] cursor-pointer">
                {showPinyin && (
                    <span className="text-base text-gray-500 leading-none">{data.pinyin || ""}</span>
                )}
                <span>
                    __
                </span>
            </span>

            {showNote && data.note && (
                <CharNote char={data.char} pinyin={data.pinyin} note={data.note} frequency={data.frequency}>
                    <span>{data.char}</span>
                </CharNote>
            )}
        </div>
    )
}
