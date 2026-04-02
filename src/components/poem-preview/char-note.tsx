/**
 * CharNotePopover 组件用于展示单个汉字的详细注释信息。
 *
 * 用途：
 * - 当用户将鼠标悬停在带注释的字上时弹出该组件，显示拼音、字本身、字的出现频率以及注释内容。
 * - 使用 Popover 组件确保在边缘显示时不会显示不全。
 * - 每条注释作为一个独立的 section 展示，含有标题和内容。
 * - 底部包含“广学”和“收藏”按钮，用于后续交互（例如标记、收藏等）。
 *
 * 使用方式：
 * ```tsx
 * <CharNotePopover
 *   char="草"
 *   pinyin="cǎo"
 *   note={[
 *     { title: "通假字", content: "通“曹”" },
 *     { title: "古义", content: "古时意为官府" }
 *   ]}
 *   frequency={114}
 * >
 *   <span>草</span>
 * </CharNotePopover>
 * ```
 */

"use client"
import React from "react";
import { Section, SectionHeading, SectionContent } from "../section";
import { Star, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface CharNoteProps {
    char: string;
    pinyin?: string;
    note: { title: string; content: string }[];
    frequency?: number;
    children?: React.ReactNode;
}

const CharNote: React.FC<CharNoteProps> = ({ char, pinyin, note, frequency, children }) => {
    const sections = note.map(n => ({ ...n, indent: true }));

    return (
        <Popover>
            <PopoverTrigger asChild>
                {children || <span>{char}</span>}
            </PopoverTrigger>
            <PopoverContent className="w-88 max-h-120 overflow-auto border shadow-lg rounded-lg bg-background">
                <div className="px-6 pb-1 text-left relative">
                    {frequency !== undefined && (
                        <div className="absolute top-1 right-1 text-base text-gray-600 pr-4 pt-2">
                            字频：{frequency}
                        </div>
                    )}
                    <div className="inline-flex flex-col items-center">
                        {pinyin && <span className="text-lg text-gray-600 leading-none">{pinyin}</span>}
                        <span className="text-4xl font-bold">{char}</span>
                    </div>
                </div>
                {sections.map((sec, idx) => (
                    <Section key={idx} padding="px-6 py-1">
                        <SectionHeading val={sec.title} level={1} />
                        <SectionContent val={sec.content} />
                    </Section>
                ))}
                <div className="p-4 text-right space-x-2">
                    <Button onClick={(e) => e.stopPropagation()}>
                        <ThumbsUp className="mr-2 h-4 w-4" /> 广学
                    </Button>
                    <Button onClick={(e) => e.stopPropagation()}>
                        <Star className="mr-2 h-4 w-4" /> 收藏
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default CharNote;