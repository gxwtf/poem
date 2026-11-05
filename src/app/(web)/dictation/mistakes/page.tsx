"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckSquare, Loader2, NotebookPen, Plus, Search, Trash2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import useSession from "@/lib/use-session"
import { MAX_IMPORT_LINES } from "@/lib/mistake-sentence"
import { cn } from "@/lib/utils"

interface MistakeItem {
    id: number
    text: string
    createdAt: string
    poem: {
        id: string
        title: string
        version: string
        author: string | null
        dynasty: string | null
    }
}

interface RejectedItem {
    input: string
    reason: string
    message: string
}

interface ImportSummary {
    added: number
    rejected: RejectedItem[]
}

function sortItems(list: MistakeItem[]): MistakeItem[] {
    return [...list].sort((a, b) => {
        if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
        return b.id - a.id
    })
}

function ReviewPanel({ summary, onClose }: { summary: ImportSummary; onClose: () => void }) {
    const duplicates = summary.rejected.filter((item) => item.reason === "duplicate")
    const failed = summary.rejected.filter((item) => item.reason !== "duplicate")

    return (
        <div className="min-w-0 overflow-hidden rounded-md bg-muted/50 p-3">
            <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm">
                    本次导入：新增{" "}
                    <span className="font-semibold text-[var(--theme-color)]">{summary.added}</span> 句
                    {duplicates.length > 0 && (
                        <>
                            ，重复跳过{" "}
                            <span className="font-semibold text-muted-foreground">
                                {duplicates.length}
                            </span>{" "}
                            句
                        </>
                    )}
                    {failed.length > 0 && (
                        <>
                            ，未通过{" "}
                            <span className="font-semibold text-destructive">{failed.length}</span> 句
                        </>
                    )}
                </p>
                <Button
                    variant="ghost"
                    size="icon"
                    className="-mr-1 -mt-1 size-6 shrink-0"
                    onClick={onClose}
                    aria-label="关闭审核结果"
                >
                    <X className="size-3.5" />
                </Button>
            </div>
            {duplicates.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                    重复句子已自动跳过，不会重复加入错题本。
                </p>
            )}
            {failed.length > 0 && (
                <ul className="mt-2 max-h-48 min-w-0 space-y-1.5 overflow-y-auto pr-1">
                    {failed.map((item, index) => (
                        <li
                            key={`${item.input}-${index}`}
                            className="flex min-w-0 flex-col gap-0.5 text-xs sm:flex-row sm:items-baseline sm:gap-2"
                        >
                            <span className="min-w-0 truncate text-foreground/80 sm:max-w-[55%]">
                                {item.input}
                            </span>
                            <span className="min-w-0 break-words text-destructive">{item.message}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default function DictationMistakesPage() {
    const { session, isLoading: sessionLoading } = useSession()
    const [items, setItems] = useState<MistakeItem[]>([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState("")
    const [selectMode, setSelectMode] = useState(false)
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [input, setInput] = useState("")
    const [singleError, setSingleError] = useState("")
    const [importing, setImporting] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [result, setResult] = useState<ImportSummary | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [addOpen, setAddOpen] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    // 加载错题本
    useEffect(() => {
        if (sessionLoading) return
        if (!session.isLoggedIn) {
            setLoading(false)
            return
        }
        let cancelled = false
        setLoading(true)
        fetch("/api/mistakes")
            .then((res) => {
                if (!res.ok) throw new Error("load failed")
                return res.json()
            })
            .then((data) => {
                if (!cancelled) setItems(sortItems(data.items ?? []))
            })
            .catch(() => {
                if (!cancelled) toast.error("加载默写错题本失败")
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [sessionLoading, session.isLoggedIn, session.userid])

    const keyword = query.trim()
    const filtered = useMemo(() => {
        if (!keyword) return items
        return items.filter(
            (item) =>
                item.text.includes(keyword) ||
                item.poem.title.includes(keyword) ||
                (item.poem.author ?? "").includes(keyword) ||
                (item.poem.dynasty ?? "").includes(keyword)
        )
    }, [items, keyword])

    const allSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.id))

    const toggleOne = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (allSelected) filtered.forEach((item) => next.delete(item.id))
            else filtered.forEach((item) => next.add(item.id))
            return next
        })
    }

    const toggleSelectMode = () => {
        if (selectMode) setSelected(new Set())
        setSelectMode((prev) => !prev)
    }

    const openAddDialog = () => {
        setSingleError("")
        setResult(null)
        setAddOpen(true)
    }

    const runImport = async (sentences: string[], source: "single" | "file") => {
        if (importing) return
        if (!session.isLoggedIn) {
            toast.error("请先登录")
            return
        }
        setImporting(true)
        setSingleError("")
        setResult(null)
        try {
            const res = await fetch("/api/mistakes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sentences }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.status === 401) {
                toast.error("请先登录")
                return
            }
            if (!res.ok) {
                toast.error(data.error || "导入失败")
                return
            }

            const added: MistakeItem[] = data.items ?? []
            const rejected: RejectedItem[] = data.rejected ?? []
            if (added.length > 0) {
                setItems((prev) => sortItems([...added, ...prev]))
            }

            if (source === "single") {
                if (added.length > 0) {
                    setInput("")
                    toast.success("已加入默写错题本")
                    setAddOpen(false)
                } else {
                    setSingleError(rejected[0]?.message || "未通过审核")
                }
                return
            }

            if (rejected.length > 0) {
                setResult({ added: added.length, rejected })
                if (added.length === 0) toast.error("没有句子通过审核")
                else toast.success(`已加入 ${added.length} 句`)
            } else if (added.length > 0) {
                toast.success(`已加入 ${added.length} 句`)
                setAddOpen(false)
            }
        } catch {
            toast.error("网络错误，请稍后重试")
        } finally {
            setImporting(false)
        }
    }

    const handleSingleAdd = () => {
        const value = input.trim()
        if (!value) return
        runImport([value], "single")
    }

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (!file) return
        if (file.size > 1024 * 1024) {
            toast.error("文件过大，请控制在 1MB 以内")
            return
        }
        const text = await file.text()
        const lines = text
            .replace(/^\uFEFF/, "")
            .split(/\r\n|\r|\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        if (lines.length === 0) {
            toast.error("TXT 中没有可导入的句子")
            return
        }
        if (lines.length > MAX_IMPORT_LINES) {
            toast.error(`单次最多导入 ${MAX_IMPORT_LINES} 句，当前文件共 ${lines.length} 句`)
            return
        }
        runImport(lines, "file")
    }

    const handleDelete = async () => {
        const ids = Array.from(selected)
        if (ids.length === 0 || deleting) return
        setDeleting(true)
        try {
            const res = await fetch("/api/mistakes", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids }),
            })
            if (!res.ok) throw new Error("delete failed")
            const data = await res.json()
            const remaining = items.filter((item) => !selected.has(item.id)).length
            setItems((prev) => prev.filter((item) => !selected.has(item.id)))
            setSelected(new Set())
            setConfirmOpen(false)
            if (remaining === 0) setSelectMode(false)
            toast.success(`已删除 ${data.deleted ?? ids.length} 句`)
        } catch {
            toast.error("删除失败，请重试")
        } finally {
            setDeleting(false)
        }
    }

    const header = (
        <SiteHeader
            now="默写错题本"
            data={[
                { name: "古诗文", href: "/overview" },
                { name: "默写整理", href: "/dictation" },
            ]}
        />
    )

    if (!sessionLoading && !session.isLoggedIn) {
        return (
            <>
                {header}
                <div className="p-4 md:p-6">
                    <div className="mx-auto max-w-xl space-y-2 py-16 text-center">
                        <NotebookPen className="mx-auto size-8 text-[var(--theme-color)]" />
                        <p className="text-lg font-medium">登录后使用默写错题本</p>
                        <p className="text-sm text-muted-foreground">
                            错题会与账号绑定，可随时查找、复习和整理
                        </p>
                        <Button asChild className="mt-2">
                            <Link href="/login">去登录</Link>
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
                <div className="mx-auto max-w-4xl space-y-4">
                    {/* 标题与添加入口 */}
                    <div className="flex items-center justify-between gap-3">
                        <h1 className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
                            <NotebookPen className="size-5 text-[var(--theme-color)]" />
                            默写错题本
                        </h1>
                        <Button onClick={openAddDialog} className="shrink-0">
                            <Plus className="size-4" />
                            添加错题
                        </Button>
                    </div>

                    {/* 搜索与多选 */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--theme-color)]" />
                                <Input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="搜索句子、篇目或作者"
                                    className="pl-8 text-primary"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleSelectMode}
                                disabled={items.length === 0 && !selectMode}
                                className="shrink-0 text-muted-foreground"
                            >
                                {selectMode ? <X className="size-4" /> : <CheckSquare className="size-4" />}
                                {selectMode ? "完成" : "多选"}
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                            <span className="text-muted-foreground">
                                共 {filtered.length} 句
                                {keyword && `（全部 ${items.length} 句）`}
                            </span>
                            {selectMode && (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            id="select-all-mistakes"
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            disabled={filtered.length === 0}
                                            className="size-4 cursor-pointer accent-[var(--theme-color)]"
                                        />
                                        <Label
                                            htmlFor="select-all-mistakes"
                                            className="cursor-pointer font-normal text-muted-foreground"
                                        >
                                            全选
                                        </Label>
                                    </div>
                                    <span className="text-muted-foreground">已选 {selected.size} 句</span>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="ml-auto"
                                        onClick={() => setConfirmOpen(true)}
                                        disabled={selected.size === 0}
                                    >
                                        <Trash2 className="size-4" />
                                        删除所选
                                    </Button>
                                </>
                            )}
                        </div>
                    </section>

                    {/* 列表 */}
                    {loading ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <Card
                                    key={index}
                                    className="border-l-4 border-l-[var(--theme-color)]/30 py-4"
                                >
                                    <CardContent className="space-y-2 px-4">
                                        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                            {items.length === 0 ? (
                                <>
                                    <NotebookPen className="mx-auto mb-3 size-8 opacity-40" />
                                    <p className="text-lg">默写错题本还是空的</p>
                                    <p className="mt-2 text-sm">点击右上角「添加错题」，输入句子或导入 TXT</p>
                                </>
                            ) : (
                                <p className="text-lg">没有找到匹配的句子</p>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {filtered.map((item) => {
                                const isSelected = selected.has(item.id)
                                const href = `/poem/${item.poem.version}/${encodeURIComponent(item.poem.title)}?highlight=${encodeURIComponent(item.text)}`
                                return (
                                    <Card
                                        key={item.id}
                                        onClick={selectMode ? () => toggleOne(item.id) : undefined}
                                        className={cn(
                                            "border-l-4 border-l-[var(--theme-color)] transition-colors",
                                            selectMode && "cursor-pointer",
                                            isSelected && "bg-[var(--theme-color)]/5"
                                        )}
                                    >
                                        <CardContent className="flex items-start gap-3 text-lg">
                                            {selectMode ? (
                                                <p className="min-w-0 flex-1 leading-relaxed break-words">
                                                    {item.text}
                                                </p>
                                            ) : (
                                                <Link
                                                    href={href}
                                                    className="block min-w-0 flex-1 leading-relaxed break-words transition-colors hover:text-[var(--theme-color)]"
                                                >
                                                    {item.text}
                                                </Link>
                                            )}
                                            {selectMode && (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleOne(item.id)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    aria-label={`选择：${item.text}`}
                                                    className="mt-1.5 size-4 shrink-0 cursor-pointer accent-[var(--theme-color)]"
                                                />
                                            )}
                                        </CardContent>
                                        <CardFooter className="justify-end text-sm text-muted-foreground">
                                            <span className="truncate">
                                                ——
                                                {item.poem.dynasty ? `【${item.poem.dynasty}】` : ""}
                                                {item.poem.author ?? "佚名"}《{item.poem.title}》
                                            </span>
                                        </CardFooter>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            <Dialog
                open={addOpen}
                onOpenChange={(open) => {
                    setAddOpen(open)
                    if (!open) {
                        setSingleError("")
                        setResult(null)
                    }
                }}
            >
                <DialogContent className="overflow-hidden sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>添加错题</DialogTitle>
                        <DialogDescription>
                            输入一句，或导入 TXT（每行一句）。只收录能定位于本站古诗文的完整句子。
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-w-0 space-y-4">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                className="flex-1 text-primary"
                                value={input}
                                onChange={(event) => {
                                    setInput(event.target.value)
                                    if (singleError) setSingleError("")
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                                        event.preventDefault()
                                        handleSingleAdd()
                                    }
                                }}
                                placeholder="如：吴楚东南坼，乾坤日夜浮。"
                                readOnly={importing}
                                aria-busy={importing}
                                aria-invalid={!!singleError}
                                autoFocus
                            />
                            <Button
                                onClick={handleSingleAdd}
                                disabled={importing || !input.trim()}
                                className="shrink-0"
                            >
                                {importing && <Loader2 className="size-4 animate-spin" />}
                                添加
                            </Button>
                        </div>

                        {singleError && (
                            <p className="flex items-center gap-1.5 text-sm text-destructive">
                                <AlertCircle className="size-3.5 shrink-0" />
                                {singleError}
                            </p>
                        )}

                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs text-muted-foreground">或</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>

                        <div className="space-y-2">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => fileRef.current?.click()}
                                disabled={importing}
                            >
                                <Upload className="size-4" />
                                从 TXT 文件导入
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                TXT 每行一句，单次最多 {MAX_IMPORT_LINES} 句；导入后会逐句审核。
                            </p>
                        </div>

                        <input
                            ref={fileRef}
                            type="file"
                            accept=".txt,text/plain"
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        {result && <ReviewPanel summary={result} onClose={() => setResult(null)} />}
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除所选错题？</AlertDialogTitle>
                        <AlertDialogDescription>
                            将删除 {selected.size} 句错题，删除后无法恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault()
                                handleDelete()
                            }}
                            disabled={deleting}
                        >
                            {deleting && <Loader2 className="size-4 animate-spin" />}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
