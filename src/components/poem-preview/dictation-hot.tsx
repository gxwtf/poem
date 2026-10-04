// 默写常考句板块：在古诗 preview 页展示该篇目考察次数最高的句子（最多 5 句）

"use client"

import { useContext, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MemorizeContext } from "./memorize-context"
import { PoemQuoteCard } from "@/components/poem-quote-card"
import { Badge } from "@/components/ui/badge"

interface DictationRow {
    id: number
    content: string
    revised: string | null
    title: string | null
    appearances: unknown[]
}

export function DictationHot() {
    const { memorize } = useContext(MemorizeContext)
    const url = decodeURI(usePathname())

    const poemParams = url.substring(url.indexOf('poem') + 5)
    const version = poemParams.substring(0, poemParams.indexOf('/'))
    const title = poemParams.substring(poemParams.indexOf('/') + 1)

    const [rows, setRows] = useState<DictationRow[] | null>(null)

    // 默写真题仅覆盖高中篇目（senior），junior 版本不展示（如 junior 的《论语》十二章）
    const enabled = version === 'senior'

    useEffect(() => {
        if (!title || !enabled) return
        fetch(`/api/dictations?poemTitle=${encodeURIComponent(title)}`)
            .then(r => r.json())
            .then(data => setRows(Array.isArray(data) ? data : []))
            .catch(() => setRows([]))
    }, [title, enabled])

    // 默认排序：考察次数降序，并列按 id 升序；取前 6（不足则全部）
    const top = useMemo(() => {
        if (!rows) return []
        return [...rows]
            .sort((a, b) => b.appearances.length - a.appearances.length || a.id - b.id)
            .slice(0, 6)
    }, [rows])

    // 链接篇名取数据行的多数标注篇名（/dictation 篇目筛选项）；同篇偶有两种标注（如 望海潮 17+2 句），取多数保证确定性
    // 注意：必须在下方早退 return 之前调用，遵守 Hooks 规则
    const linkTitle = useMemo(() => {
        if (!rows) return title
        const count = new Map<string, number>()
        for (const r of rows) if (r.title) count.set(r.title, (count.get(r.title) || 0) + 1)
        return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || title
    }, [rows, title])

    // 背诵模式（memorize 非 NaN）下隐藏，避免剧透；无数据也不渲染
    if (!enabled || !Number.isNaN(memorize) || !rows || top.length === 0) return null

    return (
        <div className="my-8 text-left">
            <div className="flex items-baseline gap-3 my-6">
                <h2 className="text-2xl font-bold text-[var(--theme-color)]">默写常考句</h2>
                <Link
                    href={`/dictation?title=${encodeURIComponent(linkTitle)}`}
                    className="text-sm text-muted-foreground hover:text-[var(--theme-color)] hover:underline"
                >
                    查看该篇目全部默写
                </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {top.map(d => (
                    <PoemQuoteCard
                        key={d.id}
                        title={title}
                        version="senior"
                        author=""
                        quote={d.revised || d.content}
                        onClick={() => {
                            // 通知 TextHighlighter 在正文中定位并高亮该句
                            document.dispatchEvent(
                                new CustomEvent("poem:jump-highlight", { detail: d.revised || d.content })
                            )
                        }}
                        quoteExtra={d.revised && d.revised !== d.content ? (
                            <span className="line-through opacity-70">原卷：{d.content}</span>
                        ) : undefined}
                        footerExtra={
                            <Badge variant="secondary" className="font-normal">
                                考察 {d.appearances.length} 次
                            </Badge>
                        }
                    />
                ))}
            </div>
        </div>
    )
}
