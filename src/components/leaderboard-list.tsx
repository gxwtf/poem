"use client"

import { useEffect, useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
    LEADERBOARD_LABELS,
    LEADERBOARD_SUBTITLES,
    LEADERBOARD_UNIT,
    type LeaderboardResponse,
    type LeaderboardType,
} from "@/lib/perfect-dictation"

/**
 * 一张打卡榜（照抄 gxexercise 的 LeaderboardList）：
 * - 桌面端：名次 / 用户 / 天数 三列表格
 * - 移动端：divide-y 竖排列表
 * - 「我的排名」单独钉在最上面一行并高亮（列表里同一个人不再重复标记）
 */

function initials(name: string) {
    const t = (name || "匿名").trim()
    return t.slice(0, 2).toUpperCase()
}

function rankTone(rank: number) {
    // 前三名：浅色用浅底深字，深色用「半透明亮色底 + 亮字 + 描边」
    if (rank === 1)
        return "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-400/20 dark:text-amber-200 dark:ring-amber-400/45"
    if (rank === 2)
        return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300 dark:bg-slate-300/20 dark:text-slate-100 dark:ring-slate-300/45"
    if (rank === 3)
        return "bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-300 dark:bg-orange-400/20 dark:text-orange-100 dark:ring-orange-400/45"
    return "bg-muted text-muted-foreground"
}

export interface LeaderboardListProps {
    type: LeaderboardType
    /** 展示前多少名 */
    limit: number
    /** 首页紧凑模式：不显示表头 */
    compact?: boolean
    /** 是否显示「我的排名」置顶行（首页不显示，完整榜单显示） */
    showMe?: boolean
}

export function LeaderboardList({
    type,
    limit,
    compact = false,
    showMe = false,
}: LeaderboardListProps) {
    const [data, setData] = useState<LeaderboardResponse | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        fetch(`/api/perfect-dictation/leaderboard?type=${type}&limit=${limit}`, {
            cache: "no-store",
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((json: LeaderboardResponse | null) => {
                if (cancelled) return
                setData(json)
            })
            .catch(() => {
                if (!cancelled) setData(null)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [type, limit])

    const rows = data?.rows ?? []
    const me = showMe ? (data?.me ?? null) : null
    const unit = data?.unit ?? LEADERBOARD_UNIT

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0">
                    <CardTitle className="text-base font-semibold">
                        {LEADERBOARD_LABELS[type]}
                    </CardTitle>
                    <CardDescription className="text-xs">
                        {LEADERBOARD_SUBTITLES[type]}
                    </CardDescription>
                </div>
                {data && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                        共 {data.totalUsers} 人上榜
                    </span>
                )}
            </CardHeader>

            <CardContent className="px-0">
                {loading ? (
                    <p className="px-5 py-12 text-center text-sm text-muted-foreground">加载中…</p>
                ) : rows.length === 0 ? (
                    <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                        还没有人打卡，完成一组完胜默写就能上榜
                    </p>
                ) : (
                    <>
                        {/* 移动端：竖向列表 */}
                        <div className="divide-y divide-border md:hidden">
                            {me && (
                                <div className="flex items-center gap-3 bg-[var(--theme-color)]/10 px-4 py-2.5">
                                    <span
                                        className={cn(
                                            "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                                            rankTone(me.rank)
                                        )}
                                    >
                                        {me.rank}
                                    </span>
                                    <Avatar className="size-8 shrink-0">
                                        <AvatarFallback>{initials(me.name || "我")}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-foreground">
                                            {me.name || "我"}
                                            <span className="ml-1 text-xs text-muted-foreground">
                                                （我）
                                            </span>
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                                        {me.days}
                                        <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                            {unit}
                                        </span>
                                    </span>
                                </div>
                            )}
                            {rows.map((row, idx) => (
                                <div key={row.userId} className="flex items-center gap-3 px-4 py-2.5">
                                    <span
                                        className={cn(
                                            "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                                            rankTone(idx + 1)
                                        )}
                                    >
                                        {idx + 1}
                                    </span>
                                    <Avatar className="size-8 shrink-0">
                                        <AvatarFallback>{initials(row.name)}</AvatarFallback>
                                    </Avatar>
                                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                        {row.name}
                                    </p>
                                    <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                                        {row.days}
                                        <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                            {unit}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* 桌面端：表格 */}
                        <div className="hidden md:block">
                            <Table>
                                {!compact && (
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-16 pl-5">名次</TableHead>
                                            <TableHead>用户</TableHead>
                                            <TableHead className="w-28 pr-5 text-right">
                                                {type === "streak" ? "连续打卡" : "累计打卡"}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                )}
                                <TableBody>
                                    {me && (
                                        <TableRow className="bg-[var(--theme-color)]/10 hover:bg-[var(--theme-color)]/15">
                                            <TableCell className="pl-5">
                                                <span
                                                    className={cn(
                                                        "inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                                                        rankTone(me.rank)
                                                    )}
                                                >
                                                    {me.rank}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar className="size-8">
                                                        <AvatarFallback>
                                                            {initials(me.name || "我")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="truncate text-sm font-medium text-foreground">
                                                        {me.name || "我"}
                                                        <span className="ml-1 text-xs text-muted-foreground">
                                                            （我）
                                                        </span>
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="pr-5 text-right text-sm font-medium tabular-nums text-foreground">
                                                {me.days}
                                                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                                    {unit}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {rows.map((row, idx) => (
                                        <TableRow key={row.userId}>
                                            <TableCell className="pl-5">
                                                <span
                                                    className={cn(
                                                        "inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                                                        rankTone(idx + 1)
                                                    )}
                                                >
                                                    {idx + 1}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar className="size-8">
                                                        <AvatarFallback>
                                                            {initials(row.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="truncate text-sm font-medium text-foreground">
                                                        {row.name}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="pr-5 text-right text-sm font-medium tabular-nums text-foreground">
                                                {row.days}
                                                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                                    {unit}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
