"use client"

/**
 * WordNotePopover —— 古诗文注释弹窗
 *
 * 单字注释（CharData.note，形如 [{title:"通假字", content:"…"}]）与
 * 多字词语注释（NoteBlock.note，一段文本）共用这一套渲染逻辑：
 * Sentence 把它们统一成 NoteBlock，再交给本组件弹出同一种面板。
 * 区别只在内容：分条注释按「小标题 + 正文」逐条渲染，整段注释直接渲染正文。
 *
 * 使用方式：
 * ```tsx
 * <WordNotePopover note="古义：指君主或上级发出的命令">
 *     <span>令</span>
 * </WordNotePopover>
 * ```
 */

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import React from "react"
import { Star, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Section, SectionContent, SectionHeading } from "../section"

/** 单字注释的一条内容 */
export type NoteEntry = { title: string; content: string }

export function WordNotePopover({
    note,
    entries,
    frequency,
    children,
    left,
    right,
}: {
    /** 整段注释（多字词语注释，也可承载拼好的单字注释文本） */
    note?: string
    /** 分条注释（单字注释），有值时优先按条目渲染 */
    entries?: NoteEntry[]
    /** 字频（目前只有单字注释带这个字段） */
    frequency?: number
    children: React.ReactNode
    left: boolean
    right: boolean
}) {
    const hasEntries = !!entries && entries.length > 0

    return (
        <Popover>
            <PopoverTrigger asChild>
                <span className={
                    `relative cursor-pointer inline-flex flex-wrap items-center align-baseline pb-1
                    after:content-[''] after:absolute
                    ${left?"after:left-[1px]":"after:left-0"}
                    ${right?"after:right-[1px]":"after:right-0"}
                    after:bottom-0
                    after:h-[2px] after:bg-[var(--theme-color)]`
                }>
                    {children}
                </span>
            </PopoverTrigger>
            <PopoverContent className="w-100 max-h-80 overflow-auto border shadow-lg rounded-lg bg-background">
                {frequency !== undefined && (
                    <div className="px-4 pt-3 text-right text-sm text-gray-600">
                        字频：{frequency}
                    </div>
                )}
                {hasEntries ? (
                    entries.map((entry, idx) => (
                        <Section key={idx} padding="px-4 py-2">
                            <SectionHeading val={entry.title} level={1} />
                            <SectionContent val={entry.content} />
                        </Section>
                    ))
                ) : (
                    <Section padding="p-2">
                        <SectionContent val={note ?? ""} />
                    </Section>
                )}
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
    )
}
