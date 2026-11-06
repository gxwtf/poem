"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    Check,
    Flame,
    Loader2,
    Minus,
    Play,
    Plus,
    Settings2,
    NotebookPen,
} from "lucide-react"
import { toast } from "sonner"

import useSession from "@/lib/use-session"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { BookScopePicker, scopeRangeLabel } from "@/components/dictation-book-scope"
import { cn } from "@/lib/utils"
import {
    MAX_DAILY_COUNT,
    MIN_DAILY_COUNT,
    clampDailyCount,
    type PerfectDictationHome,
    type PerfectDictationSettings,
    type PracticeMode,
} from "@/lib/perfect-dictation"

const MODE_OPTIONS: {
    value: PracticeMode
    label: string
    description: string
}[] = [
    {
        value: "mixed",
        label: "错题为主，新句为辅",
        description: "优先复习到期的错题，再搭配少量年级高频新句",
    },
    {
        value: "mistakes",
        label: "只考默写错题",
        description: "只复习默写错题本中的句子",
    },
    {
        value: "new",
        label: "只考新句子",
        description: "练习年级高频的新句子",
    },
]

function WeekStrip({ week }: { week: PerfectDictationHome["week"] }) {
    const today = week[week.length - 1]?.day
    return (
        <div className="hidden items-end gap-1 lg:flex">
            {week.map((item) => (
                <div key={item.day} className="flex flex-col items-center gap-1" title={item.day}>
                    <span
                        className={cn(
                            "flex size-5 items-center justify-center rounded-full text-[9px]",
                            item.checked
                                ? "bg-[var(--theme-color)] text-white"
                                : "bg-muted text-muted-foreground",
                            item.day === today && !item.checked && "ring-1 ring-[var(--theme-color)]/50"
                        )}
                    >
                        {item.checked ? <Check className="size-3" /> : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {item.weekday.replace("周", "")}
                    </span>
                </div>
            ))}
        </div>
    )
}

export function PerfectDictation() {
    const { session, isLoading } = useSession()
    const router = useRouter()
    const [data, setData] = useState<PerfectDictationHome | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)
    const [starting, setStarting] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [draftMode, setDraftMode] = useState<PracticeMode>("mixed")
    const [draftCount, setDraftCount] = useState("10")
    const [draftBooks, setDraftBooks] = useState<string[]>([])
    const [savingSettings, setSavingSettings] = useState(false)

    useEffect(() => {
        if (isLoading) return
        if (!session?.isLoggedIn) {
            setLoading(false)
            return
        }

        let cancelled = false
        setLoading(true)
        setError(false)
        fetch("/api/perfect-dictation")
            .then(async (response) => {
                if (!response.ok) throw new Error("加载失败")
                return (await response.json()) as PerfectDictationHome
            })
            .then((home) => {
                if (cancelled) return
                setData(home)
                setDraftMode(home.settings.mode)
                setDraftCount(String(home.settings.dailyCount))
                setDraftBooks(home.settings.books ?? [])
            })
            .catch(() => {
                if (!cancelled) setError(true)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [isLoading, session?.isLoggedIn, reloadKey])

    async function patchSettings(patch: Partial<PerfectDictationSettings>) {
        const response = await fetch("/api/perfect-dictation", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        })
        if (!response.ok) throw new Error("保存失败")
        const json = (await response.json()) as { settings: PerfectDictationSettings }
        setData((previous) => {
            if (!previous) return previous
            const settings = json.settings
            const books = settings.books ?? []
            // PATCH 只回设置，不发范围；按新设置就地推一遍 scope，卡片上的范围文案立刻同步
            return {
                ...previous,
                settings,
                scope: {
                    ...previous.scope,
                    customBooks: books,
                    effectiveBooks: books.length > 0 ? books : previous.scope.defaultBooks,
                },
            }
        })
        return json.settings
    }

    function openSettings() {
        if (!data) return
        setDraftMode(data.settings.mode)
        setDraftCount(String(data.settings.dailyCount))
        setDraftBooks(data.settings.books ?? [])
        setSettingsOpen(true)
    }

    function changeDraftCount(delta: number) {
        const parsed = Number.parseInt(draftCount, 10)
        const base = Number.isFinite(parsed) ? parsed : (data?.settings.dailyCount ?? 10)
        setDraftCount(String(clampDailyCount(base + delta)))
    }

    async function saveSettings() {
        if (!data || savingSettings) return
        const parsed = Number.parseInt(draftCount, 10)
        const dailyCount = clampDailyCount(
            Number.isFinite(parsed) ? parsed : data.settings.dailyCount
        )

        setSavingSettings(true)
        try {
            const settings = await patchSettings({ mode: draftMode, dailyCount, books: draftBooks })
            setDraftCount(String(settings.dailyCount))
            setDraftBooks(settings.books ?? [])
            setSettingsOpen(false)
            toast.success("设置已保存")
        } catch {
            toast.error("保存设置失败，请重试")
        } finally {
            setSavingSettings(false)
        }
    }

    function start() {
        if (!data || starting) return
        setStarting(true)
        router.push("/perfect-dictation")
        setStarting(false)
    }

    const header = (
        <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-[var(--theme-color)]">
                    <NotebookPen className="size-5" />
                </div>
                <h2 className="truncate text-base font-semibold sm:text-lg">完胜默写</h2>
            </div>
            {data && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={openSettings}
                    className="shrink-0 text-muted-foreground"
                >
                    <Settings2 className="size-4" />
                    <span className="hidden xl:inline">设置</span>
                </Button>
            )}
        </div>
    )

    const progressRow = data ? (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <WeekStrip week={data.week} />
            <div
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-[var(--theme-color)]"
                aria-label={`连续打卡 ${data.streak} 天`}
            >
                <Flame className="size-4" />
                <span className="hidden lg:inline">连续打卡&nbsp;</span>
                <span>{data.streak} 天</span>
            </div>
        </div>
    ) : null

    if (isLoading || (session?.isLoggedIn && loading)) {
        return (
            <Card className="flex h-full min-h-[256px] flex-col gap-0 py-0">
                <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                    {header}
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-9 w-40 max-w-full" />
                        <Skeleton className="h-7 w-28" />
                    </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 sm:p-5 sm:pt-0">
                    <Skeleton className="h-9 w-full" />
                </CardFooter>
            </Card>
        )
    }

    if (!session?.isLoggedIn) {
        return (
            <Card className="flex h-full min-h-[256px] flex-col gap-0 py-0">
                <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                    {header}
                    <p className="text-sm text-muted-foreground">
                        登录后开始每日默写打卡，系统会从错题本和年级高频句中替你组题。
                    </p>
                </CardContent>
                <CardFooter className="p-4 pt-0 sm:p-5 sm:pt-0">
                    <Button asChild className="w-full">
                        <Link href="/login?back=/dashboard">登录后打卡</Link>
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    if (error || !data) {
        return (
            <Card className="flex h-full min-h-[256px] flex-col gap-0 py-0">
                <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                    {header}
                    <div className="mt-auto flex items-center gap-2 text-sm text-muted-foreground">
                        <span>完胜默写加载失败。</span>
                        <Button variant="link" className="h-auto p-0" onClick={() => setReloadKey((k) => k + 1)}>
                            重试
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card className="flex h-full min-h-[256px] flex-col gap-0 py-0">
                <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                    {header}
                    {data.scope && (
                        <p className="text-xs text-muted-foreground">
                            范围：{scopeRangeLabel(data.scope)}
                        </p>
                    )}
                    {progressRow}
                </CardContent>
                <CardFooter className="p-4 pt-0 sm:p-5 sm:pt-0">
                    <Button
                        onClick={start}
                        disabled={starting}
                        className="w-full"
                    >
                        {starting ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Play className="size-4" />
                        )}
                        {data.checkedInToday ? "再来一组" : "开始默写"}
                    </Button>
                </CardFooter>
            </Card>

            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>完胜默写设置</DialogTitle>
                        <DialogDescription>选择考察方式、考察范围和每组题数。</DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
                        <div className="space-y-2">
                            <Label>考察方式</Label>
                            <div className="space-y-2">
                                {MODE_OPTIONS.map((option) => {
                                    const selected = draftMode === option.value
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setDraftMode(option.value)}
                                            className={cn(
                                                "flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left transition-colors",
                                                selected
                                                    ? "border-[var(--theme-color)] bg-muted/50"
                                                    : "hover:bg-muted/30"
                                            )}
                                        >
                                            <span>
                                                <span className="block text-sm font-medium">
                                                    {option.label}
                                                </span>
                                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                                    {option.description}
                                                </span>
                                            </span>
                                            {selected && (
                                                <Check className="mt-0.5 size-4 shrink-0 text-[var(--theme-color)]" />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="perfect-dictation-count">每组题数</Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => changeDraftCount(-1)}
                                    disabled={Number(draftCount) <= MIN_DAILY_COUNT}
                                    aria-label="减少每组题数"
                                >
                                    <Minus className="size-3.5" />
                                </Button>
                                <Input
                                    id="perfect-dictation-count"
                                    value={draftCount}
                                    onChange={(event) => setDraftCount(event.target.value)}
                                    onBlur={() => {
                                        const parsed = Number.parseInt(draftCount, 10)
                                        setDraftCount(
                                            String(
                                                clampDailyCount(
                                                    Number.isFinite(parsed)
                                                        ? parsed
                                                        : data.settings.dailyCount
                                                )
                                            )
                                        )
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") event.currentTarget.blur()
                                    }}
                                    inputMode="numeric"
                                    min={MIN_DAILY_COUNT}
                                    max={MAX_DAILY_COUNT}
                                    className="h-8 w-16 text-center text-primary"
                                    aria-label="每组题数"
                                />
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => changeDraftCount(1)}
                                    disabled={Number(draftCount) >= MAX_DAILY_COUNT}
                                    aria-label="增加每组题数"
                                >
                                    <Plus className="size-3.5" />
                                </Button>
                                <span className="text-sm text-muted-foreground">句 / 组</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                每天完成一组即可打卡，也可以继续做多组。
                            </p>
                        </div>

                        {data.scope && (
                            <div className="border-t pt-4">
                                <BookScopePicker
                                    scope={data.scope}
                                    value={draftBooks}
                                    onChange={setDraftBooks}
                                    disabled={savingSettings}
                                />
                            </div>
                        )}

                        <Button
                            className="w-full"
                            onClick={() => void saveSettings()}
                            disabled={savingSettings}
                        >
                            {savingSettings && <Loader2 className="size-4 animate-spin" />}
                            保存设置
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
