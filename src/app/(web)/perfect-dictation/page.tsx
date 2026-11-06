"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    BookMarked,
    CheckCircle2,
    Clock3,
    Loader2,
    RotateCcw,
    SlidersHorizontal,
    Sparkles,
    XCircle,
    Zap,
} from "lucide-react"
import { toast } from "sonner"

import { SiteHeader } from "@/components/site-header"
import { BookScopePicker, scopeRangeLabel } from "@/components/dictation-book-scope"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import useSession from "@/lib/use-session"
import { cn } from "@/lib/utils"
import {
    PRACTICE_RESULT_LABELS,
    type CompleteGroupResponse,
    type DictationScope,
    type GroupResponse,
    type PerfectDictationHome,
    type PerfectDictationSettings,
    type PracticeQuestion,
    type PracticeResult,
} from "@/lib/perfect-dictation"

type Phase = "login" | "loading" | "question" | "answer" | "submitting" | "summary" | "empty" | "error"

interface AnsweredQuestion {
    question: PracticeQuestion
    result: PracticeResult
}

const RESULT_STYLES: Record<PracticeResult, string> = {
    correct: "bg-emerald-500/10 text-emerald-600",
    wrong: "bg-red-500/10 text-red-600",
    not_yet: "bg-muted text-muted-foreground",
    too_easy: "bg-amber-500/10 text-amber-600",
}

export default function PerfectDictationPage() {
    const { session, isLoading } = useSession()
    const router = useRouter()
    const started = useRef(false)
    const submittingRef = useRef(false)
    const [phase, setPhase] = useState<Phase>("loading")
    const [questions, setQuestions] = useState<PracticeQuestion[]>([])
    const [index, setIndex] = useState(0)
    const [revealed, setRevealed] = useState(false)
    const [results, setResults] = useState<AnsweredQuestion[]>([])
    const [mode, setMode] = useState<GroupResponse["mode"]>("mixed")
    const [summary, setSummary] = useState<CompleteGroupResponse | null>(null)
    const [errorMessage, setErrorMessage] = useState("")
    const [scope, setScope] = useState<DictationScope | null>(null)
    const [scopeOpen, setScopeOpen] = useState(false)
    const [draftBooks, setDraftBooks] = useState<string[]>([])
    const [savingScope, setSavingScope] = useState(false)
    const submitting = phase === "submitting"

    async function loadScope() {
        try {
            const response = await fetch("/api/perfect-dictation")
            if (!response.ok) return
            const home = (await response.json()) as PerfectDictationHome
            if (home?.scope) setScope(home.scope)
        } catch {
            // 范围栏只是辅助信息，取不到就整块隐藏，不影响练习流程
        }
    }

    function openScope() {
        if (!scope) return
        setDraftBooks(scope.customBooks ?? [])
        setScopeOpen(true)
    }

    async function saveScope() {
        if (!scope || savingScope) return
        setSavingScope(true)
        try {
            const response = await fetch("/api/perfect-dictation", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ books: draftBooks }),
            })
            if (!response.ok) throw new Error("保存考察范围失败")
            const json = (await response.json()) as { settings: PerfectDictationSettings }
            const books = json.settings?.books ?? draftBooks
            setScope((previous) =>
                previous
                    ? {
                          ...previous,
                          customBooks: books,
                          effectiveBooks: books.length > 0 ? books : previous.defaultBooks,
                      }
                    : previous
            )
            setScopeOpen(false)
            toast.success("考察范围已更新")
            await loadGroup()
        } catch {
            toast.error("保存考察范围失败，请重试")
        } finally {
            setSavingScope(false)
        }
    }

    async function loadGroup() {
        setPhase("loading")
        setErrorMessage("")
        setSummary(null)
        setRevealed(false)
        setIndex(0)
        setResults([])

        try {
            const response = await fetch("/api/perfect-dictation/group", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            })
            if (response.status === 401) {
                router.push("/login?back=/perfect-dictation")
                return
            }
            if (!response.ok) {
                const body = (await response.json().catch(() => ({}))) as { error?: string }
                throw new Error(body.error || "生成题目失败")
            }
            const group = (await response.json()) as GroupResponse
            setMode(group.mode)
            setQuestions(group.questions)
            setPhase(group.questions.length > 0 ? "question" : "empty")
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "生成题目失败")
            setPhase("error")
        }
    }

    useEffect(() => {
        if (isLoading) return
        if (!session?.isLoggedIn) {
            setPhase("login")
            return
        }
        if (started.current) return
        started.current = true
        void loadGroup()
        void loadScope()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, session?.isLoggedIn])

    const question = questions[index]
    const progress = questions.length > 0 ? ((index + (revealed ? 0.5 : 0)) / questions.length) * 100 : 0

    async function choose(result: PracticeResult) {
        if (!revealed || !question || submitting || submittingRef.current) return

        const answered: AnsweredQuestion = { question, result }
        if (index < questions.length - 1) {
            setResults((previous) => [...previous, answered])
            setIndex((previous) => previous + 1)
            setRevealed(false)
            setPhase("question")
            return
        }

        const all = [...results, answered]
        submittingRef.current = true
        setPhase("submitting")
        try {
            const response = await fetch("/api/perfect-dictation/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode,
                    results: all.map((item) => ({
                        poemId: item.question.poemId,
                        text: item.question.answer,
                        pool: item.question.pool,
                        result: item.result,
                    })),
                }),
            })
            if (!response.ok) {
                const body = (await response.json().catch(() => ({}))) as { error?: string }
                throw new Error(body.error || "保存本组结果失败")
            }
            const completed = (await response.json()) as CompleteGroupResponse
            setResults(all)
            setSummary(completed)
            setPhase("summary")
        } catch (error) {
            setPhase("answer")
            toast.error(error instanceof Error ? error.message : "保存本组结果失败，请重试")
        } finally {
            submittingRef.current = false
        }
    }

    const header = (
        <SiteHeader now="完胜默写" data={[{ name: "古诗文", href: "/overview" }]} />
    )

    if (phase === "login") {
        return (
            <>
                {header}
                <div className="p-4 md:p-6">
                    <div className="mx-auto max-w-xl space-y-2 py-16 text-center">
                        <Sparkles className="mx-auto size-8 text-[var(--theme-color)]" />
                        <p className="text-lg font-medium">登录后开始完胜默写</p>
                        <p className="text-sm text-muted-foreground">
                            每天一组，按遗忘曲线与年级高频考点替你组题
                        </p>
                        <Button asChild className="mt-2">
                            <Link href="/login?back=/perfect-dictation">去登录</Link>
                        </Button>
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            {header}
            <div className="p-2 sm:p-4 md:p-6">
                <div className="mx-auto max-w-3xl space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                            <Link href="/dashboard">
                                <ArrowLeft className="size-4" />
                                返回首页
                            </Link>
                        </Button>
                        {phase !== "empty" && phase !== "error" && questions.length > 0 && (
                            <span className="text-sm text-muted-foreground">
                                {phase === "summary" ? `共 ${questions.length} 题` : `第 ${index + 1} / ${questions.length} 题`}
                            </span>
                        )}
                    </div>

                    {scope && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                            <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                                <BookMarked className="size-4 shrink-0 text-[var(--theme-color)]" />
                                <span className="truncate">范围：{scopeRangeLabel(scope)}</span>
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 text-muted-foreground"
                                onClick={openScope}
                                disabled={savingScope}
                            >
                                <SlidersHorizontal className="size-4" />
                                调整范围
                            </Button>
                        </div>
                    )}

                    {phase === "loading" && (
                        <Card>
                            <CardContent className="space-y-6 p-5 sm:p-8">
                                <div className="space-y-2 text-center">
                                    <Skeleton className="mx-auto h-4 w-32" />
                                    <Skeleton className="mx-auto h-4 w-24" />
                                </div>
                                <div className="space-y-3">
                                    <Skeleton className="mx-auto h-8 w-4/5" />
                                    <Skeleton className="mx-auto h-8 w-3/5" />
                                </div>
                                <Skeleton className="mx-auto h-10 w-28" />
                            </CardContent>
                        </Card>
                    )}

                    {phase === "error" && (
                        <Card>
                            <CardContent className="space-y-4 p-8 text-center">
                                <p className="text-sm text-muted-foreground">{errorMessage || "加载失败"}</p>
                                <div className="flex justify-center gap-2">
                                    <Button onClick={() => void loadGroup()}>
                                        <RotateCcw className="size-4" />
                                        重试
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <Link href="/dashboard">返回首页</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {phase === "empty" && (
                        <Card>
                            <CardContent className="space-y-3 p-8 text-center">
                                <Sparkles className="mx-auto size-8 text-[var(--theme-color)]" />
                                <p className="text-lg font-medium">当前考察方式下暂无可用句子</p>
                                <p className="text-sm text-muted-foreground">
                                    {mode === "mistakes"
                                        ? "当前没有可复习的错题：错题本可能为空，或这些句子都已标记为「太简单」。"
                                        : "当前没有可考察的新句：可能已经练完，或都被标记为「太简单」。"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {scope
                                        ? "当前范围内没有可练的句子，试试把范围放宽或全选。"
                                        : "回首页打开设置调整考察方式，或去默写错题本补充几句。"}
                                </p>
                                <div className="flex flex-wrap justify-center gap-2 pt-1">
                                    {scope && (
                                        <Button onClick={openScope}>
                                            <SlidersHorizontal className="size-4" />
                                            调整范围
                                        </Button>
                                    )}
                                    <Button variant={scope ? "outline" : "default"} asChild>
                                        <Link href="/dashboard">回首页调整</Link>
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <Link href="/dictation/mistakes">去默写错题本</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {(phase === "question" || phase === "answer" || phase === "submitting") && question && (
                        <>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>进度</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-[var(--theme-color)] transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-6 px-1 py-2 text-primary sm:px-2 sm:py-4">
                                    <div className="space-y-5 text-center sm:space-y-6">
                                        <h1 className="text-2xl font-bold text-[var(--theme-color)] sm:text-3xl">
                                            《{question.title}》
                                        </h1>
                                        {(question.dynasty || question.author) && (
                                            <p className="text-base text-muted-foreground sm:text-lg">
                                                {question.dynasty ? `【${question.dynasty}】` : ""}
                                                {question.author ?? ""}
                                            </p>
                                        )}
                                    </div>

                                    <div className="text-center font-serif text-xl leading-loose tracking-wide sm:text-2xl">
                                        {question.lines.flatMap((line, lineIndex) =>
                                            line.parts.map((part, partIndex) =>
                                                part.blank ? (
                                                    <span
                                                        key={`${lineIndex}-${partIndex}`}
                                                        className="relative top-[0.25em] mx-1 inline-block w-14 border-b border-primary align-baseline sm:w-20"
                                                        aria-label="空白"
                                                    />
                                                ) : (
                                                    <span key={`${lineIndex}-${partIndex}`}>{part.text}</span>
                                                )
                                            )
                                        )}
                                    </div>

                                    {!revealed ? (
                                        <div className="flex justify-center">
                                            <Button size="lg" onClick={() => setRevealed(true)}>
                                                显示答案
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="rounded-lg bg-muted/50 p-4 text-center">
                                                <p className="font-serif text-xl text-[var(--theme-color)] sm:text-2xl">
                                                    {question.answer}
                                                </p>
                                                {question.sourceSentence !== question.answer &&
                                                    question.sourceSentence.length <= 50 && (
                                                        <p className="mt-2 text-sm text-muted-foreground">
                                                            原句：{question.sourceSentence}
                                                        </p>
                                                    )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                <Button
                                                    variant="outline"
                                                    className="h-auto flex-col gap-1 py-3"
                                                    onClick={() => void choose("correct")}
                                                    disabled={submitting}
                                                >
                                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                                    正确
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="h-auto flex-col gap-1 py-3"
                                                    onClick={() => void choose("wrong")}
                                                    disabled={submitting}
                                                >
                                                    <XCircle className="size-4 text-red-600" />
                                                    错误
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="h-auto flex-col gap-1 py-3"
                                                    onClick={() => void choose("not_yet")}
                                                    disabled={submitting}
                                                >
                                                    <Clock3 className="size-4 text-muted-foreground" />
                                                    还没背
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="h-auto flex-col gap-1 py-3"
                                                    onClick={() => void choose("too_easy")}
                                                    disabled={submitting}
                                                >
                                                    <Zap className="size-4 text-amber-600" />
                                                    太简单
                                                </Button>
                                            </div>
                                            {submitting && (
                                                <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                                                    <Loader2 className="size-3.5 animate-spin" />
                                                    正在保存本组结果…
                                                </p>
                                            )}
                                        </div>
                                    )}
                            </div>
                        </>
                    )}

                    {phase === "summary" && summary && (
                        <Card>
                            <CardContent className="space-y-5 p-5 sm:p-8">
                                <div className="space-y-2 text-center">
                                    <CheckCircle2 className="mx-auto size-9 text-[var(--theme-color)]" />
                                    <h1 className="text-xl font-semibold">本组完成</h1>
                                    <p className="text-sm text-muted-foreground">
                                        连续打卡 {summary.streak} 天 · 今日已完成 {summary.todayGroups} 组
                                    </p>
                                </div>

                                <div className="grid grid-cols-4 gap-2 text-center">
                                    {(
                                        [
                                            ["正确", summary.correct],
                                            ["错误", summary.wrong],
                                            ["还没背", summary.notYet],
                                            ["太简单", summary.tooEasy],
                                        ] as const
                                    ).map(([label, value]) => (
                                        <div key={label} className="rounded-lg bg-muted/50 py-2">
                                            <p className="text-lg font-semibold">{value}</p>
                                            <p className="text-xs text-muted-foreground">{label}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-sm font-medium">本组答案</h2>
                                    <ol className="space-y-2">
                                        {results.map((item, itemIndex) => (
                                            <li
                                                key={`${item.question.poemId}-${item.question.normalized}-${itemIndex}`}
                                                className="rounded-md bg-muted/40 px-3 py-2"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="font-serif text-base leading-relaxed">
                                                            {item.question.answer}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                                            《{item.question.title}》
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={cn(
                                                            "shrink-0 rounded-full px-2 py-0.5 text-xs",
                                                            RESULT_STYLES[item.result]
                                                        )}
                                                    >
                                                        {PRACTICE_RESULT_LABELS[item.result]}
                                                    </span>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>

                                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
                                    <Button onClick={() => void loadGroup()}>
                                        <RotateCcw className="size-4" />
                                        再来一组
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <Link href="/dashboard">返回首页</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>调整考察范围</DialogTitle>
                        <DialogDescription>
                            选择这次出题用到的册次，保存后会重新出一组题。
                        </DialogDescription>
                    </DialogHeader>
                    {scope && (
                        <div className="space-y-4">
                            <BookScopePicker
                                scope={scope}
                                value={draftBooks}
                                onChange={setDraftBooks}
                                disabled={savingScope}
                            />
                            <Button
                                className="w-full"
                                onClick={() => void saveScope()}
                                disabled={savingScope}
                            >
                                {savingScope && <Loader2 className="size-4 animate-spin" />}
                                保存并重新出题
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
