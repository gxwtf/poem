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
import useSession from "@/lib/use-session"
import { cn } from "@/lib/utils"
import {
    LEADERBOARD_LABELS,
    LEADERBOARD_SUBTITLES,
    LEADERBOARD_TYPES,
    LEADERBOARD_UNIT,
    type LeaderboardResponse,
    type LeaderboardRow,
    type LeaderboardType,
} from "@/lib/perfect-dictation"

/**
 * 完胜默写打卡榜：UI 照抄广学题库（~/gxexercise）的「广学榜」
 * （src/components/leaderboard/LeaderboardList.tsx + (root)/page.tsx 的首页区块），
 * 只把「题数/得分」两列换成「连续/累计」两列，榜名换成勤学榜/积跬榜。
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

interface ListProps {
    title: string
    subtitle: string
    data: LeaderboardResponse | null
    loading: boolean
    highlightUserId?: number | null
}

function LeaderboardList({ title, subtitle, data, loading, highlightUserId }: ListProps) {
    const rows = data?.rows ?? []
    const me = data?.me ?? null
    const unit = data?.unit ?? LEADERBOARD_UNIT

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0">
                    <CardTitle className="text-base font-semibold">{title}</CardTitle>
                    <CardDescription className="text-xs">{subtitle}</CardDescription>
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
                        {/* 移动端：竖向列表（不横向滚动） */}
                        <div className="divide-y divide-border md:hidden">
                            {me && (
                                <div className="flex items-center gap-3 bg-[var(--theme-color)]/5 px-4 py-2.5">
                                    <span
                                        className={cn(
                                            "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                                            rankTone(me.rank)
                                        )}
                                    >
                                        {me.rank}
                                    </span>
                                    <Avatar className="size-8 shrink-0">
                                        <AvatarFallback className="bg-[var(--theme-color)]/10 text-[var(--theme-color)]">
                                            {initials(me.name || "我")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-foreground">
                                            {me.name || "我"}
                                            <span className="ml-1 text-xs text-[var(--theme-color)]">
                                                （我）
                                            </span>
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {me.streak} {unit}连续 · {me.total} {unit}累计
                                        </p>
                                    </div>
                                </div>
                            )}
                            {rows.map((row, idx) => {
                                const mine =
                                    highlightUserId != null && row.userId === highlightUserId
                                return (
                                    <div
                                        key={row.userId}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-2.5",
                                            mine && "bg-[var(--theme-color)]/5"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                                                rankTone(idx + 1)
                                            )}
                                        >
                                            {idx + 1}
                                        </span>
                                        <Avatar className="size-8 shrink-0">
                                            <AvatarFallback
                                                className={
                                                    idx < 3
                                                        ? "bg-[var(--theme-color)]/10 text-[var(--theme-color)]"
                                                        : undefined
                                                }
                                            >
                                                {initials(row.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-foreground">
                                                {row.name}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {row.streak} {unit}连续 · {row.total} {unit}累计
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* 桌面端：表格 */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-16 pl-5">名次</TableHead>
                                        <TableHead>用户</TableHead>
                                        <TableHead className="w-24 text-right">连续</TableHead>
                                        <TableHead className="w-24 pr-5 text-right">累计</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {me && (
                                        <TableRow className="bg-[var(--theme-color)]/5 hover:bg-[var(--theme-color)]/10">
                                            <TableCell className="pl-5">
                                                <div className="flex items-center">
                                                    <span
                                                        className={cn(
                                                            "inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                                                            rankTone(me.rank)
                                                        )}
                                                    >
                                                        {me.rank}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar className="size-8">
                                                        <AvatarFallback className="bg-[var(--theme-color)]/10 text-[var(--theme-color)]">
                                                            {initials(me.name || "我")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="truncate text-sm font-medium text-foreground">
                                                        {me.name || "我"}
                                                        <span className="ml-1 text-xs text-[var(--theme-color)]">
                                                            （我）
                                                        </span>
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                                {me.streak}
                                                <span className="ml-0.5 text-xs">{unit}</span>
                                            </TableCell>
                                            <TableCell className="pr-5 text-right text-sm font-medium tabular-nums text-foreground">
                                                {me.total}
                                                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                                    {unit}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {rows.map((row, idx) => {
                                        const rank = idx + 1
                                        const mine =
                                            highlightUserId != null &&
                                            row.userId === highlightUserId
                                        return (
                                            <TableRow
                                                key={row.userId}
                                                className={cn(
                                                    mine && "bg-[var(--theme-color)]/5"
                                                )}
                                            >
                                                <TableCell className="pl-5">
                                                    <span
                                                        className={cn(
                                                            "inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                                                            rankTone(rank)
                                                        )}
                                                    >
                                                        {rank}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar className="size-8">
                                                            <AvatarFallback
                                                                className={
                                                                    rank <= 3
                                                                        ? "bg-[var(--theme-color)]/10 text-[var(--theme-color)]"
                                                                        : undefined
                                                                }
                                                            >
                                                                {initials(row.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="truncate text-sm font-medium text-foreground">
                                                            {row.name}
                                                            {mine && (
                                                                <span className="ml-1 text-xs text-[var(--theme-color)]">
                                                                    （我）
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                                    {row.streak}
                                                    <span className="ml-0.5 text-xs">{unit}</span>
                                                </TableCell>
                                                <TableCell className="pr-5 text-right text-sm font-medium tabular-nums text-foreground">
                                                    {row.total}
                                                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                                        {unit}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}

export default function PerfectDictationLeaderboard() {
    const { session } = useSession()
    const [data, setData] = useState<Partial<Record<LeaderboardType, LeaderboardResponse>>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        async function load() {
            const results = await Promise.all(
                LEADERBOARD_TYPES.map(async (type) => {
                    try {
                        const response = await fetch(
                            `/api/perfect-dictation/leaderboard?type=${type}`,
                            { cache: "no-store" }
                        )
                        if (!response.ok) return null
                        return [type, (await response.json()) as LeaderboardResponse] as const
                    } catch {
                        return null
                    }
                })
            )
            if (cancelled) return
            const next: Partial<Record<LeaderboardType, LeaderboardResponse>> = {}
            for (const item of results) if (item) next[item[0]] = item[1]
            setData(next)
            setLoading(false)
        }
        void load()
        return () => {
            cancelled = true
        }
    }, [])

    const highlightUserId = session?.isLoggedIn ? (session.userid ?? null) : null
    const rowsOf = (type: LeaderboardType) => data[type] ?? null

    return (
        <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-bold text-foreground">广学榜</h2>
                <span className="text-sm text-muted-foreground">
                    完胜默写打卡排行 · 完成一组即计一天
                </span>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                {LEADERBOARD_TYPES.map((type) => (
                    <LeaderboardList
                        key={type}
                        title={LEADERBOARD_LABELS[type]}
                        subtitle={LEADERBOARD_SUBTITLES[type]}
                        data={rowsOf(type)}
                        loading={loading}
                        highlightUserId={highlightUserId}
                    />
                ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
                统计规则：当天完成过至少一组完胜默写即记 1 天，同一天多组只算一次；勤学榜按当前连续天数排名（中断一天从零重算，不影响累计），积跬榜按累计天数排名。
            </p>
        </section>
    )
}
