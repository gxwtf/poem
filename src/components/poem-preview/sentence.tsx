"use client"

// 古诗文句子组件

import { Char, CharData } from "./char"
import { WordNotePopover } from "./word-note"


export type NoteBlock = {
    start: number
    end: number
    note: string
}

export type TranslationData = {
    translation: string
    highlight?: boolean
}

// 判断是否是首字：每个小短句的首个汉字
// 小短句以句号、叹号、问号等分隔，每个新句子的第一个非标点字符是首字
function isFirstCharInSentence(charIndex: number, sentence: CharData[]): boolean {
    if (charIndex === 0) {
        // 第一个字符如果是汉字，就是首字
        return !isPunctuation((sentence[charIndex] as CharData).char);
    }

    // 往前找，如果前面有标点符号，且标点后第一个汉字是当前字符
    for (let i = charIndex - 1; i >= 0; i--) {
        const c = (sentence[i] as CharData).char;
        if (isPunctuation(c)) {
            // 这是一个标点符号，如果从后一个位置到当前字符之前都是标点，那么当前字符是首字
            for (let j = i + 1; j < charIndex; j++) {
                if (isPunctuation((sentence[j] as CharData).char)) {
                    continue;
                }
            }
            // 当前字符是标点后第一个非标点字符
            return !isPunctuation((sentence[charIndex] as CharData).char);
        }
    }
    return false;
}

function isPunctuation(char: string): boolean {
    return `。，、；：？！"'（）【】《》…—·～\n\r`.includes(char);
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
    mouseDownStat
}: {
    sent: SentenceData,
    showPinyin: boolean,
    highlight: boolean,
    showNotes: boolean
    mouseDownStat: boolean
}) {
    const { sentence, notes } = sent;
    const charList: React.ReactNode[] = [];
    for (let i = 0; i < sentence.length; i++) {
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
                        mouseDownStat={mouseDownStat}
                        isFirstChar={j === 0 && isFirst}
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
                    mouseDownStat={mouseDownStat}
                    isFirstChar={isCharFirst}
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
