"use client"

// 完胜默写排行榜（勤学榜 = 连续打卡，积跬榜 = 累计打卡）
//
// 数据来自 GET /api/perfect-dictation/leaderboard?type=streak|total
// 未登录也能看榜（me 为 null），所以不要因为没登录就跳过请求。

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Flame, Footprints, Trophy } from "lucide-react"

import useSession from "@/lib/use-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
    LEADERBOARD_HINTS,
    LEADERBOARD_LABELS,
    LEADERBOARD_TYPES,
    type LeaderboardEntry,
    type LeaderboardResponse,
    type LeaderboardType,
} from "@/lib/perfect-dictation"

const TYPE_ICONS: Record<LeaderboardType, typeof Flame> = {
    streak: Flame,
    total: Footprints,
}

/** 前三名的徽章样式（金银铜 + 奖牌） */
const MEDALS: { emoji: string; className: string }[] = [
    {
        emoji: "🥇",
        className: "bg-linear-to-br from-amber-300 to-yellow-600 ring-amber-400/40",
    },
    {
        emoji: "🥈",
        className: "bg-linear-to-br from-slate-200 to-slate-400 ring-slate-300/40",
    },
    {
        emoji: "🥉",
        className: "bg-linear-to-br from-orange-300 to-amber-700 ring-orange-400/40",
    },
]

interface RankRowProps {
    rank: number
    name: string
    score: number
    unit: string
    isMe?: boolean
}

function RankRow({ rank, name, score, unit, isMe }: RankRowProps) {
    const medal = rank <= 3 ? MEDALS[rank - 1] : null

    return (
        <div
            className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors sm:px-4",
                isMe
                    ? "border-[var(--theme-color)] bg-[var(--theme-color)]/5"
                    : "border-transparent bg-muted/40 hover:bg-muted/70"
            )}
        >
            <div
                className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-base leading-none",
                    medal
                        ? cn("font-bold text-white shadow-sm ring-2", medal.className)
                        : "bg-background text-sm font-semibold text-muted-foreground tabular-nums"
                )}
                aria-label={`第 ${rank} 名`}
            >
                {/* 名次数字始终显示（不依赖系统 emoji 字体），奖牌只是锦上添花 */}
                <span className="font-bold tabular-nums">{rank}</span>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate text-sm font-medium sm:text-base">{name}</span>
                {medal && (
                    <span className="shrink-0 text-sm leading-none" aria-hidden>
                        {medal.emoji}
                    </span>
                )}
                {isMe && (
                    <Badge
                        variant="outline"
                        className="shrink-0 border-[var(--theme-color)] px-1.5 text-[10px] leading-4 text-[var(--theme-color)]"
                    >
                        我
                    </Badge>
                )}
            </div>

            <div className="shrink-0 text-sm font-bold tabular-nums text-[var(--theme-color)] sm:text-base">
                {score}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
            </div>
        </div>
    )
}

function LeaderboardSkeleton() {
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5 sm:px-4">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-12 shrink-0" />
                </div>
            ))}
        </div>
    )
}

function percentBeaten(rank: number, totalParticipants: number): number {
    if (totalParticipants <= 0) return 0
    return Math.round((1 - (rank - 1) / totalParticipants) * 100)
}

export default function PerfectDictationLeaderboard() {
    const { session } = useSession()
    const [type, setType] = useState<LeaderboardType>("streak")
    const [data, setData] = useState<LeaderboardResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)

    // 已拿到的榜单缓存，切回同一个 tab 时不重复请求
    const cacheRef = useRef<Map<LeaderboardType, LeaderboardResponse>>(new Map())

    useEffect(() => {
        const cached = cacheRef.current.get(type)
        if (cached) {
            setData(cached)
            setFailed(false)
            setLoading(false)
            return
        }

        const controller = new AbortController()
        setLoading(true)
        setFailed(false)
        setData(null)

        async function load() {
            try {
                const response = await fetch(
                    `/api/perfect-dictation/leaderboard?type=${type}`,
                    { signal: controller.signal, cache: "no-store" }
                )
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                const result = (await response.json()) as LeaderboardResponse
                if (controller.signal.aborted) return
                cacheRef.current.set(type, result)
                setData(result)
                setLoading(false)
            } catch (error) {
                if (controller.signal.aborted) return
                console.error("加载排行榜失败:", error)
                setFailed(true)
                setLoading(false)
                setData(null)
            }
        }

        load()

        return () => controller.abort()
    }, [type, reloadKey])

    const retry = useCallback(() => {
        cacheRef.current.delete(type)
        setReloadKey((key) => key + 1)
    }, [type])

    // 我是否已出现在榜单里（否则单独钉一行）
    const me = data?.me ?? null
    const meInRank = me !== null && (data?.rank.some((entry) => entry.isMe) ?? false)
    const showPinnedMe = me !== null && !meInRank
    const unit = data?.unit || "天"

    const body = loading ? (
        <LeaderboardSkeleton />
    ) : failed || !data ? (
        <button
            type="button"
            onClick={retry}
            className="w-full rounded-xl border border-transparent bg-muted/40 py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
            加载失败，点此重试
        </button>
    ) : data.rank.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/40 py-10 text-center">
            <p className="text-sm text-muted-foreground">还没有人打卡，来做第一个吧</p>
            <Button asChild size="sm">
                <Link href="/perfect-dictation">去练习</Link>
            </Button>
        </div>
    ) : (
        <div className="flex flex-col gap-3">
            {showPinnedMe && (
                <div className="flex flex-col gap-1">
                    <p className="px-1 text-xs font-medium text-muted-foreground">我的排名</p>
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--theme-color)] bg-[var(--theme-color)]/10 px-3 py-2.5 sm:px-4">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--theme-color)] text-sm font-bold text-white tabular-nums">
                            {me.rank}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-medium sm:text-base">
                                    {session?.real_name || session?.username || "我的排名"}
                                </span>
                                <Badge
                                    variant="outline"
                                    className="shrink-0 border-[var(--theme-color)] px-1.5 text-[10px] leading-4 text-[var(--theme-color)]"
                                >
                                    我
                                </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                第 {me.rank} 名 · {me.score} {unit}
                            </span>
                        </div>
                        <div className="shrink-0 text-sm font-bold tabular-nums text-[var(--theme-color)] sm:text-base">
                            {me.score}
                            <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                {unit}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
                {data.rank.map((entry: LeaderboardEntry, index: number) => (
                    <RankRow
                        key={`${entry.userId}-${index}`}
                        rank={index + 1}
                        name={entry.name}
                        score={entry.score}
                        unit={unit}
                        isMe={entry.isMe}
                    />
                ))}
            </div>
        </div>
    )

    const totalParticipants = data?.totalParticipants ?? 0

    const footer = !loading && !failed && data && data.rank.length > 0 && (
        <CardFooter className="justify-center px-4 pt-0 text-xs text-muted-foreground sm:px-6">
            {me ? (
                <span>
                    共 {totalParticipants} 人参与 · 你超过了 {percentBeaten(me.rank, totalParticipants)}% 的参与者
                </span>
            ) : session?.isLoggedIn ? (
                <span>共 {totalParticipants} 人参与 · 练一天就能上榜</span>
            ) : (
                <span>共 {totalParticipants} 人参与</span>
            )}
        </CardFooter>
    )

    return (
        <Card className="gap-4 py-4 sm:py-5">
            <CardContent className="flex flex-col gap-3 px-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-[var(--theme-color)]">
                            <Trophy className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold sm:text-lg">排行榜</h2>
                            <p className="truncate text-xs text-muted-foreground">
                                {LEADERBOARD_HINTS[type]}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-1 rounded-full bg-muted p-1" role="group" aria-label="排行榜类型">
                    {LEADERBOARD_TYPES.map((item) => {
                        const Icon = TYPE_ICONS[item]
                        const active = item === type
                        return (
                            <button
                                key={item}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setType(item)}
                                className={cn(
                                    "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none sm:px-5",
                                    active
                                        ? "bg-[var(--theme-color)] text-white shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon className="size-4" />
                                {LEADERBOARD_LABELS[item]}
                            </button>
                        )
                    })}
                </div>

                {body}
            </CardContent>
            {footer}
        </Card>
    )
}
