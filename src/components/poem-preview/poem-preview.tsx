// 古诗文预览组件

"use client"

import { useState, useContext, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Paragraph, ParagraphData } from "./paragraph";
import { Memorize } from "./memorize";
import { MemorizeContext } from "./memorize-context";
import { StarButton } from "../star";
import { Book, BookOpen, Music, Music3, FileText, FileCheck, Scissors } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

function ControlButtons({
    showTranslation,
    setShowTranslation,
    showPinyin,
    setShowPinyin,
    showNotes,
    setShowNotes
}: {
    showTranslation: boolean
    setShowTranslation: React.Dispatch<React.SetStateAction<boolean>>
    showPinyin: boolean
    setShowPinyin: React.Dispatch<React.SetStateAction<boolean>>
    showNotes: boolean
    setShowNotes: React.Dispatch<React.SetStateAction<boolean>>
}) {
    const { memorize } = useContext(MemorizeContext);
    const url = decodeURI(usePathname());

    const poemParams = url.substring(url.indexOf('poem') + 5);
    const version = poemParams.substring(0,poemParams.indexOf('/'));
    const title = poemParams.substring(poemParams.indexOf('/')+1);

    return (
        <div className="flex justify-center gap-4 my-4 flex-wrap">
            <Button variant="outline" className="text-primary flex items-center gap-2" onClick={() => setShowTranslation(v => !v)}>
                {showTranslation ? <BookOpen className="w-4 h-4" /> : <Book className="w-4 h-4" />}
                <span className="hidden sm:inline">{showTranslation ? "隐藏翻译" : "显示翻译"}</span>
            </Button>
            {isNaN(memorize) ? (
                <Button variant="outline" className="text-primary flex items-center gap-2" onClick={() => setShowPinyin(v => !v)}>
                    {showPinyin ? <Music3 className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                    <span className="hidden sm:inline">{showPinyin ? "隐藏拼音" : "显示拼音"}</span>
                </Button>
            ) : null}
            {isNaN(memorize) ? (
                <Button variant="outline" className="text-primary flex items-center gap-2" onClick={() => setShowNotes(v => !v)}>
                    {showNotes ? <FileCheck className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    <span className="hidden sm:inline">{showNotes ? "隐藏注释" : "显示注释"}</span>
                </Button>
            ) : null}
            <Button asChild variant="outline" className="text-primary flex items-center gap-2">
                <Link href={`/breaksentence/${version}/${title}`}>
                    <Scissors className="w-4 h-4" />
                    <span className="hidden sm:inline">断句</span>
                </Link>
            </Button>
            <Memorize></Memorize>
            <StarButton version={version} title={title}></StarButton>
        </div>
    )
}

export interface PreviewData {
    mode: "poem" | "paragraph";
    preview: ParagraphData[];
}

export interface PoemPreviewProps {
    data: PreviewData;
}

export function PoemPreview({ data }: PoemPreviewProps) {
    const {
        mode,
        preview,
    } = data;
    const [showPinyin, setShowPinyin] = useState(false)
    const [showTranslation, setShowTranslation] = useState(false)
    const [showNotes, setShowNotes] = useState(true)  // 默认显示注释
    const { memorize } = useContext(MemorizeContext);

    useEffect(() => {
        console.log('XC', memorize);
        if (isNaN(memorize)) setShowNotes(true);
        else setShowNotes(false);
    }, [memorize]);

    return (
        <>
            <div className="max-w-full mx-auto">
                <ControlButtons
                    showTranslation={showTranslation}
                    setShowTranslation={setShowTranslation}
                    showPinyin={showPinyin}
                    setShowPinyin={setShowPinyin}
                    showNotes={showNotes}
                    setShowNotes={setShowNotes}
                />
                <div className={mode === "poem" ? "text-center" : "text-left"}>
                    {preview.map((paragraph, pIdx) => (
                        <div key={pIdx} className={mode === "paragraph" ? "my-4" : ""}>
                            <Paragraph
                                para={paragraph}
                                showPinyin={showPinyin}
                                showTranslation={showTranslation}
                                mode={mode}
                                showNotes={showNotes}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}
