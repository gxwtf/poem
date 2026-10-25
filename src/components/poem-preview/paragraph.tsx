"use client"

// 古诗文段落组件

import { useState } from "react";
import {Sentence, SentenceData, Translation} from "./sentence";

export type ParagraphData = {
    paragraph: SentenceData[]
}

export function Paragraph({
    para,
    showPinyin,
    showTranslation,
    mode,
    showNotes
}: {
    para: ParagraphData
    showPinyin: boolean
    showTranslation: boolean
    mode: "poem" | "paragraph"
    showNotes: boolean
}) {
    const [highlightId, setHighlightId] = useState<number | null>(null);

    const handleMouseEnter = (id: number) => {
        setHighlightId(id);
    };

    const handleMouseLeave = () => {
        setHighlightId(null);
    };

    return (
        <div className={`leading-13 poem-text${showPinyin ? " poem-text--pinyin" : ""}`}>
            <div className="sentences">
                {mode === "paragraph" && <span className="poem-indent-2"></span>}
                {para.paragraph.map((s, index) => (
                    <span
                        key={index}
                        onMouseEnter={() => showTranslation && handleMouseEnter(index)}
                        onMouseLeave={() => showTranslation && handleMouseLeave()}
                        className={`inline ${highlightId === index ? "highlight" : ""}`}
                    >
                        <Sentence 
                            sent={s} 
                            showPinyin={showPinyin} 
                            highlight={highlightId === index} 
                            showNotes={showNotes}
                            atomicClauses={mode === "poem"}
                        />
                    </span>
                ))}
            </div>
            {showTranslation && (
                <div className="translations mt-4">
                    {mode === "paragraph" && <span className="poem-indent-trans"></span>}
                    {para.paragraph.map((s, index) =>
                        s.translation ? (
                            <span
                                key={index}
                                onMouseEnter={() => showTranslation && handleMouseEnter(index)}
                                onMouseLeave={() => showTranslation && handleMouseLeave()}
                                className={`${highlightId === index ? "highlight" : ""} inline`}
                            >
                                <Translation 
                                    translation={s.translation.translation} 
                                    highlight={highlightId === index} 
                                />
                            </span>
                        ) : null
                    )}
                </div>
            )}
        </div>
    );
}