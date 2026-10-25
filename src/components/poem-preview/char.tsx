// 古诗文汉字组件

"use client"

import { useState, useContext, useEffect } from "react";
import {
    isCharHideMode,
    isFirstCharMode,
    isMemorizeMode,
    isSentenceHideMode,
    MemorizeContext,
} from "./memorize-context";
import { isBlank, isPunctuation } from "@/lib/poem-text";
import { punctKind } from "@/lib/punctuation";
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
    isFirstChar,  // 是否是首字
    unitHidden = false,  // 是否处于「被隐藏的整句」中（仅随机隐藏整句模式使用）
    squeeze = false  // 是否紧跟在另一个标点之后（标点挤压）
}: {
    data: CharData
    showPinyin: boolean
    highlight: boolean
    isFirstChar?: boolean
    unitHidden?: boolean
    squeeze?: boolean
}) {
    const { memorize } = useContext(MemorizeContext);
    const [ memorizeMode, setMemorizeMode ] = useState(CharMode.Read);
    const mouseDownStat = useContext(MouseDownStatContext);

    // 标点单独给宽度（点号 1 字位、半角括号 0.5 字位…），见 app/poem-preview.css
    const kind = punctKind(data.char);
    const punctAttr = kind !== "none" && kind !== "space" ? kind : undefined;

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

    if (memorizeMode !== CharMode.Memorize){
        return (
            <div
                data-char={data.char}
                data-punct={punctAttr}
                data-squeeze={squeeze ? "1" : undefined}
                className={`
                    inline-block justify-center
                    ${memorizeMode === CharMode.Read || memorizeMode === CharMode.FirstChar ? "text-primary" : "text-[var(--theme-color)]"}
                    ${highlight ? "bg-yellow-100" : ""}
                    relative
                    ${isMemorizeMode(memorize) ? "select-none" : ""}
                `}
            >
                <span className="char-cell inline-flex flex-col items-center cursor-pointer">
                    {showPinyin && (
                        <span className="char-pinyin text-gray-500 leading-none">{data.pinyin || ""}</span>
                    )}
                    {/* 注释（无论单字还是多字）统一由 Sentence 用 WordNotePopover 包裹，
                        这里只负责画字本身 */}
                    {data.char}
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
            data-punct={punctAttr}
            data-squeeze={squeeze ? "1" : undefined}
            className={`inline-block justify-center text-primary ${highlight ? "bg-yellow-100" : ""} relative select-none`}
            onMouseOver={handleMouseOver}
            onMouseDown={handleMouseDown}
        >
            <span className="char-cell inline-flex flex-col items-center cursor-pointer">
                {showPinyin && (
                    <span className="char-pinyin text-gray-500 leading-none">{data.pinyin || ""}</span>
                )}
                <span>
                    __
                </span>
            </span>
        </div>
    )
}
