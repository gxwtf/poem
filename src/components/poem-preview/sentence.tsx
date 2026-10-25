"use client"

// 古诗文句子组件

import { Fragment, useContext, useMemo } from "react"
import { Char, CharData } from "./char"
import { WordNotePopover } from "./word-note"
import { isSentenceHideMode, MemorizeContext, sentenceHideDifficulty } from "./memorize-context"
import { computeUnitHidingMask, isPunctuation } from "@/lib/poem-text"
import { computeSqueeze, groupChars, isClauseEnd } from "@/lib/punctuation"


export type NoteBlock = {
    start: number
    end: number
    /** 整段注释文本（多字词语注释用；单字注释会由分条内容拼出一份兜底文本） */
    note: string
    /** 分条注释（单字注释用，与多字注释共用同一个弹窗组件） */
    entries?: { title: string; content: string }[]
    /** 字频（仅单字注释带） */
    frequency?: number
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
        <span className={`text-gray-500 ${highlight ? "bg-yellow-100" : ""}`}>
            {translation}
        </span>
    );
}

export function Sentence({
    sent,
    showPinyin,
    highlight,
    showNotes,
    atomicClauses = false,
}: {
    sent: SentenceData,
    showPinyin: boolean,
    highlight: boolean,
    showNotes: boolean,
    /** 诗词模式：以小句为单位整句换行（长句仍可内部折行），避免诗句被拆开 */
    atomicClauses?: boolean
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

    // 逐字渲染（下标与 sentence 对齐），再按「禁则」合并成不可断行的单元
    const chars = sentence.map(c => c.char);
    const squeeze = useMemo(() => computeSqueeze(chars), [sentence]);  // eslint-disable-line react-hooks/exhaustive-deps
    const units = useMemo(() => groupChars(chars), [sentence]);        // eslint-disable-line react-hooks/exhaustive-deps

    // 注释统一成 NoteBlock：多字注释来自 sent.notes，单字注释挂在字上（CharData.note）。
    // 两者渲染走同一个 WordNotePopover，不再有「单字一套、多字一套」的两套逻辑。
    const noteMap = useMemo(() => {
        const map = new Map<number, NoteBlock>();
        notes?.forEach((n) => map.set(n.start, n));
        sentence.forEach((c, i) => {
            if (!c.note || c.note.length === 0 || map.has(i)) return;
            map.set(i, {
                start: i,
                end: i,
                note: c.note.map((n) => (n.title ? `${n.title}：${n.content}` : n.content)).join("\n"),
                entries: c.note,
                frequency: c.frequency,
            });
        });
        return map;
    }, [sentence, notes]);

    const items: React.ReactNode[] = new Array(sentence.length).fill(null);
    for (let i = 0; i < sentence.length; i++) {
        const hidden = unitHidden ? unitHidden[i] : false;
        const note = noteMap.get(i);
        if (note && showNotes) {  // 仅在显示注释时才渲染注释
            const length = note.end - note.start + 1;
            const isFirst = i === 0 || !isPunctuation(sentence[i]?.char || '');
            // 注释单元只有第一个字可能是「首字」
            for (let j = 0; j < length; j++) {
                items[i + j] = (
                    <WordNotePopover
                        key={i + j}
                        note={note.note}
                        entries={note.entries}
                        frequency={note.frequency}
                        left={j == 0}
                        right={j == length - 1}
                    >
                        <Char
                            data={sentence[i + j]}
                            showPinyin={showPinyin}
                            highlight={highlight}
                            isFirstChar={j === 0 && isFirst}
                            unitHidden={unitHidden ? unitHidden[i + j] : false}
                            squeeze={squeeze[i + j]}
                        />
                    </WordNotePopover>
                );
            }
            i = note.end;
        }
        else {
            const isCharPunctuation = isPunctuation(sentence[i].char);
            const isCharFirst = !isCharPunctuation &&
                (i === 0 ||
                 isPunctuation(sentence[i-1]?.char || ''));
            items[i] = (
                <Char
                    key={i}
                    data={sentence[i]}
                    showPinyin={showPinyin}
                    highlight={highlight}
                    isFirstChar={isCharFirst}
                    unitHidden={hidden}
                    squeeze={squeeze[i]}
                />
            );
        }
    }

    // 单个字照旧直接渲染；多个字的单元套一层 nowrap，保证「字+其后的标点」
    // 以及「开引号/开括号+其后的字」不会被拆到两行（避头尾）
    const unitNodes: React.ReactNode[] = units.map((unit, k) => {
        if (unit.length === 1) return items[unit[0]];
        return (
            <span className="poem-nowrap" key={`unit-${k}`}>
                {unit.map(idx => items[idx])}
            </span>
        );
    });

    // 以点号为界把单元切成小句。诗词模式下每个小句作为整体参与换行，
    // 这样诗句不会被从中间拆开（旧行为是碰巧字宽对上，字距一变就散了）。
    const clauses: React.ReactNode[][] = [];
    let clause: React.ReactNode[] = [];
    units.forEach((unit, k) => {
        clause.push(unitNodes[k]);
        if (isClauseEnd(chars[unit[unit.length - 1]])) {
            clauses.push(clause);
            clause = [];
        }
    });
    if (clause.length > 0) clauses.push(clause);

    const charList: React.ReactNode[] = clauses.map((unitsInClause, k) => (
        atomicClauses
            ? <span className="poem-clause" key={`clause-${k}`}>{unitsInClause}</span>
            : <Fragment key={`clause-${k}`}>{unitsInClause}</Fragment>
    ));

    return (
        <span>{charList}</span>
    )
}
