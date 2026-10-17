"use client"

// 古诗文句子组件

import { useContext, useMemo } from "react"
import { Char, CharData } from "./char"
import { WordNotePopover } from "./word-note"
import { isSentenceHideMode, MemorizeContext, sentenceHideDifficulty } from "./memorize-context"
import { computeUnitHidingMask, isPunctuation } from "@/lib/poem-text"


export type NoteBlock = {
    start: number
    end: number
    note: string
}

export type TranslationData = {
    translation: string
    highlight?: boolean
}

export type SentenceData = {
    sentence: CharData[]
    notes: NoteBlock[]
    translation?: TranslationData
}

export function Translation({
    translation,
    highlight
}: {
    translation: string
    highlight: boolean
}) {
    return (
        <span className={`text-xl text-gray-500 ${highlight ? "bg-yellow-100" : ""}`}>
            {translation}
        </span>
    );
}

export function Sentence({
    sent,
    showPinyin,
    highlight,
    showNotes,
}: {
    sent: SentenceData,
    showPinyin: boolean,
    highlight: boolean,
    showNotes: boolean
}) {
    const { sentence, notes } = sent;
    const { memorize } = useContext(MemorizeContext);

    // 随机隐藏整句：整句（以标点为界的小句）是否隐藏在这里统一决定，
    // 保证同一句内所有字共享同一次随机结果，且每次进入该模式重新掷骰
    const unitHidden = useMemo(
        () => isSentenceHideMode(memorize)
            ? computeUnitHidingMask(sentence.map(c => c.char), sentenceHideDifficulty(memorize))
            : null,
        [memorize, sentence]
    );

    const charList: React.ReactNode[] = [];
    for (let i = 0; i < sentence.length; i++) {
        const hidden = unitHidden ? unitHidden[i] : false;
        const note = notes?.find(n => n.start == i);
        let unit: React.ReactNode;
        if (note && showNotes) {  // 仅在显示注释时才渲染词语注释
            const length = note.end - note.start + 1;
            const isFirst = i === 0 || !isPunctuation(sentence[i]?.char || '');
            // 对于词语注释，只有当第一个字是首字时才算首字提示
            unit = Array.from({ length: (note.end - note.start + 1) }).map((_, j) => (
                <WordNotePopover key={i + j} note={note.note} left={j==0} right={j==length-1}>
                    <Char
                        data={sentence[i + j]}
                        showPinyin={showPinyin}
                        highlight={highlight}
                        showNotes={showNotes}
                        isFirstChar={j === 0 && isFirst}
                        unitHidden={unitHidden ? unitHidden[i + j] : false}
                    />
                </WordNotePopover>
            ));
            i = note.end;
        }
        else {
            const isCharPunctuation = isPunctuation(sentence[i].char);
            const isCharFirst = !isCharPunctuation &&
                (i === 0 ||
                 isPunctuation(sentence[i-1]?.char || ''));
            unit = (
                <Char
                    key={i}
                    data={sentence[i]}
                    showPinyin={showPinyin}
                    highlight={highlight}
                    showNotes={showNotes}
                    isFirstChar={isCharFirst}
                    unitHidden={hidden}
                />
            );
        }
        if (Array.isArray(unit)) {
            charList.push(...unit);
        } else {
            charList.push(unit);
        }
    }
    return (
        <span className="text-2xl leading-10">{charList}</span>
    )
}
