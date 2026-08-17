"use client"

import React, { useEffect, useMemo, useState } from "react"
import { SiteHeader } from "@/components/site-header"
import { PoemQuoteCard, SkeletonPoemQuoteCard } from "@/components/poem-quote-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface Appearance {
    category: string
    year: number
    region: string
    paper: string
}

interface Dictation {
    id: number
    content: string
    revised: string | null
    sourceType: string
    note: string | null
    title: string | null
    author: string | null
    dynasty: string | null
    poemTitle: string | null
    poemVersion: string | null
    appearances: Appearance[]
}

const PAGE_SIZE = 100

export default function DictationPage() {
    const [dictations, setDictations] = useState<Dictation[]>([])
    const [loading, setLoading] = useState(true)
    const [visible, setVisible] = useState(PAGE_SIZE)

    // 筛选条件
    const [yearRange, setYearRange] = useState("all")
    const [region, setRegion] = useState("all")
    const [category, setCategory] = useState("all")

    useEffect(() => {
        fetch("/api/dictations")
            .then(r => r.json())
            .then(data => setDictations(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    // 数据中的最新年份，作为"近 N 年"基准
    const maxYear = useMemo(() => {
        let y = 0
        for (const d of dictations) for (const a of d.appearances) if (a.year > y) y = a.year
        return y
    }, [dictations])

    // 地区选项：按卷子数降序
    const regionOptions = useMemo(() => {
        const count = new Map<string, number>()
        for (const d of dictations) for (const a of d.appearances) count.set(a.region, (count.get(a.region) || 0) + 1)
        return [...count.entries()].sort((x, y) => y[1] - x[1]).map(([r]) => r)
    }, [dictations])

    // 类别选项：固定顺序
    const categoryOptions = useMemo(() => {
        const set = new Set<string>()
        for (const d of dictations) for (const a of d.appearances) set.add(a.category)
        const order = ["真题", "一模", "二模", "上期末", "下期末"]
        return [...set].sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b)
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        })
    }, [dictations])

    const filterActive = yearRange !== "all" || region !== "all" || category !== "all"

    // 按筛选条件统计每句考察次数并排序
    const filtered = useMemo(() => {
        const yearFrom = yearRange === "all" ? 0 : maxYear - parseInt(yearRange, 10) + 1
        const rows = dictations.map(d => {
            const apps = d.appearances.filter(a =>
                a.year >= yearFrom &&
                (region === "all" || a.region === region) &&
                (category === "all" || a.category === category)
            )
            return { d, count: apps.length }
        })
        const shown = filterActive ? rows.filter(r => r.count > 0) : rows
        shown.sort((x, y) => y.count - x.count || y.d.appearances.length - x.d.appearances.length || x.d.id - y.d.id)
        return shown
    }, [dictations, yearRange, region, category, filterActive, maxYear])

    // 筛选变化时重置分页
    useEffect(() => setVisible(PAGE_SIZE), [yearRange, region, category])

    return (
        <>
            <SiteHeader
                now="默写整理"
                data={[
                    { name: "古诗文", href: "/overview" },
                    { name: "默写整理", href: "/dictation" },
                ]}
            />
            <div className="p-2 sm:p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-4">
                    {/* 筛选表单 */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">年份</Label>
                            <Select value={yearRange} onValueChange={setYearRange}>
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部</SelectItem>
                                    <SelectItem value="3">近 3 年</SelectItem>
                                    <SelectItem value="5">近 5 年</SelectItem>
                                    <SelectItem value="10">近 10 年</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">地区</Label>
                            <Select value={region} onValueChange={setRegion}>
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部</SelectItem>
                                    {regionOptions.map(r => (
                                        <SelectItem key={r} value={r}>{r}卷</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">类别</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部</SelectItem>
                                    {categoryOptions.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="text-sm text-muted-foreground ml-auto pb-2">
                            共 {filtered.length} 句
                            {filterActive && "（按筛选范围统计）"}
                        </div>
                    </div>

                    {/* 列表 */}
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => <SkeletonPoemQuoteCard key={i} />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {filtered.slice(0, visible).map(({ d, count }) => {
                                const quote = d.revised || d.content
                                const hasLink = !!d.poemTitle
                                const href = hasLink
                                    ? `/poem/${d.poemVersion}/${encodeURIComponent(d.poemTitle!)}?highlight=${encodeURIComponent(quote)}`
                                    : undefined
                                return (
                                    <PoemQuoteCard
                                        key={d.id}
                                        title={d.title || "未查明出处"}
                                        version={d.poemVersion || "senior"}
                                        author={d.author || "佚名"}
                                        dynasty={d.dynasty || undefined}
                                        quote={quote}
                                        href={href}
                                        unlinked={!hasLink}
                                        quoteExtra={d.revised && d.revised !== d.content ? (
                                            <span className="line-through opacity-70">原卷：{d.content}</span>
                                        ) : undefined}
                                        footerExtra={
                                            <span className="flex items-center gap-1.5">
                                                {count > 0 && (
                                                    <Badge variant="secondary" className="font-normal">
                                                        考察 {count} 次
                                                    </Badge>
                                                )}
                                                {d.note?.includes("人工核查") && (
                                                    <Badge variant="outline" className="font-normal text-muted-foreground">
                                                        待核
                                                    </Badge>
                                                )}
                                            </span>
                                        }
                                        footerNote={d.sourceType === "none" ? (
                                            <span className="truncate">{d.note || "未查明出处"}</span>
                                        ) : undefined}
                                    />
                                )
                            })}
                        </div>
                    )}

                    {/* 加载更多 */}
                    {!loading && visible < filtered.length && (
                        <div className="flex justify-center">
                            <Button variant="outline" onClick={() => setVisible(v => v + PAGE_SIZE)}>
                                加载更多（{filtered.length - visible}）
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
