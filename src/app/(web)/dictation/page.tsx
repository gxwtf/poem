"use client"

import React, { useEffect, useMemo, useState } from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { PoemQuoteCard, SkeletonPoemQuoteCard } from "@/components/poem-quote-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface Appearance {
    category: string
    grade: string
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
    const [grade, setGrade] = useState("all")
    const [title, setTitle] = useState("all")
    const [titleOpen, setTitleOpen] = useState(false)

    useEffect(() => {
        fetch("/api/dictations")
            .then(r => r.json())
            .then(data => setDictations(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    // 从 URL ?title= 初始化篇目筛选（如 preview 常考句的"查看该篇目全部默写"链接）
    useEffect(() => {
        const t = new URLSearchParams(window.location.search).get("title")
        if (t) setTitle(t)
    }, [])

    // 数据加载后校验：URL 传入的篇目不存在时回退全部
    useEffect(() => {
        if (dictations.length > 0 && title !== "all" && !dictations.some(d => d.title === title)) {
            setTitle("all")
        }
    }, [dictations, title])

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

    // 篇目选项：按句数降序
    const titleOptions = useMemo(() => {
        const count = new Map<string, number>()
        for (const d of dictations) if (d.title) count.set(d.title, (count.get(d.title) || 0) + 1)
        return [...count.entries()]
            .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "zh"))
            .map(([name, count]) => ({ name, count }))
    }, [dictations])

    const filterActive = yearRange !== "all" || region !== "all" || category !== "all" || grade !== "all" || title !== "all"

    // 按筛选条件统计每句考察次数并排序
    const filtered = useMemo(() => {
        const yearFrom = yearRange === "all" ? 0 : maxYear - parseInt(yearRange, 10) + 1
        const rows = dictations.map(d => {
            const apps = d.appearances.filter(a =>
                a.year >= yearFrom &&
                (region === "all" || a.region === region) &&
                (category === "all" || a.category === category) &&
                (grade === "all" || a.grade === grade)
            )
            return { d, count: apps.length }
        })
        const byTitle = title === "all" ? rows : rows.filter(r => r.d.title === title)
        const shown = filterActive ? byTitle.filter(r => r.count > 0) : byTitle
        shown.sort((x, y) => y.count - x.count || y.d.appearances.length - x.d.appearances.length || x.d.id - y.d.id)
        return shown
    }, [dictations, yearRange, region, category, grade, title, filterActive, maxYear])

    // 筛选变化时重置分页
    useEffect(() => setVisible(PAGE_SIZE), [yearRange, region, category, grade, title])

    return (
        <>
            <SiteHeader
                now="默写整理"
                data={[
                    { name: "古诗文", href: "/overview" },
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
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">年级</Label>
                            <Select value={grade} onValueChange={setGrade}>
                                <SelectTrigger className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部</SelectItem>
                                    <SelectItem value="高三">高三</SelectItem>
                                    <SelectItem value="高二">高二</SelectItem>
                                    <SelectItem value="高一">高一</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">篇目</Label>
                            <Popover open={titleOpen} onOpenChange={setTitleOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-40 justify-between font-normal">
                                        <span className="truncate">{title === "all" ? "全部" : title}</span>
                                        <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="搜索篇目…" />
                                        <CommandList>
                                            <CommandEmpty>未找到篇目</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="全部"
                                                    onSelect={() => { setTitle("all"); setTitleOpen(false) }}
                                                >
                                                    <CheckIcon className={cn("size-4 shrink-0", title === "all" ? "opacity-100" : "opacity-0")} />
                                                    全部
                                                </CommandItem>
                                                {titleOptions.map(({ name, count }) => (
                                                    <CommandItem
                                                        key={name}
                                                        value={name}
                                                        onSelect={() => { setTitle(name); setTitleOpen(false) }}
                                                    >
                                                        <CheckIcon className={cn("size-4 shrink-0", title === name ? "opacity-100" : "opacity-0")} />
                                                        <span className="truncate">{name}</span>
                                                        <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
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
                                                        考查 {count} 次
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
