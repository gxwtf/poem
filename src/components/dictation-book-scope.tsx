"use client"

import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { DICTATION_RECITE_TAG, type DictationScope } from "@/lib/perfect-dictation"

export interface BookScopePickerProps {
    scope: DictationScope
    /** 草稿选择；空数组 = 跟随年级默认 */
    value: string[]
    onChange: (next: string[]) => void
    disabled?: boolean
}

/** 按 scope.books 的顺序排列册次，scope 里没有的（理论上不会出现）排在最后 */
export function orderBooks(scope: DictationScope, books: string[]): string[] {
    const keys = scope.books.map((book) => book.key)
    const known = keys.filter((key) => books.includes(key))
    const extra = books.filter((book) => !keys.includes(book))
    return [...known, ...extra]
}

/**
 * 卡片 / 范围栏上的一行范围文案：
 * - 「必修上」
 * - 「选必上、选必中（高二默认）」
 * - 「必修下（自选）」
 * - 「不限（高三）」/「不限」
 */
export function scopeRangeLabel(scope: DictationScope): string {
    const effective = scope.effectiveBooks

    if (!effective || effective.length === 0) {
        if (scope.gradeLabel === "高三") return "不限（高三）"
        if (!scope.gradeLabel) return "不限（未识别年级）"
        return "不限"
    }

    const text = orderBooks(scope, effective).join("、")
    if (scope.customBooks.length > 0) return `${text}（自选）`
    return scope.gradeLabel ? `${text}（${scope.gradeLabel}默认）` : `${text}（年级默认）`
}

/** 设置里那行「按年级默认：高二上学期 → 选必上、选必中」的说明 */
export function scopeDefaultHint(scope: DictationScope): string {
    const defaultBooks = scope.defaultBooks

    if (!defaultBooks || defaultBooks.length === 0) {
        if (scope.gradeLabel === "高三") return "高三不受册次限制（全部篇目）"
        return "未识别年级，暂不限册次"
    }

    const grade = scope.gradeLabel ?? "本年级"
    const books = orderBooks(scope, defaultBooks).join("、")
    return `按年级默认：${grade}${scope.semesterLabel} → ${books}`
}

export function BookScopePicker({
    scope,
    value,
    onChange,
    disabled = false,
}: BookScopePickerProps) {
    const allKeys = scope.books.map((book) => book.key)
    const usingDefault = value.length === 0
    const defaultBooks = scope.defaultBooks

    // 未自选时高亮的是「年级默认」的册次；默认不限时不高亮任何一册
    const highlighted = usingDefault
        ? orderBooks(scope, defaultBooks ?? [])
        : orderBooks(scope, value)
    const highlightedSet = new Set(highlighted)
    const allSelected =
        value.length > 0 && allKeys.length > 0 && allKeys.every((key) => value.includes(key))

    function toggle(key: string) {
        if (disabled) return
        const base = usingDefault ? (defaultBooks ?? []) : value
        const next = base.includes(key)
            ? base.filter((item) => item !== key)
            : [...base, key]
        // 至少留一册：空数组的语义是「跟随年级默认」，不能让取消操作变成回退默认
        if (next.length === 0) return
        onChange(next)
    }

    const statusText = usingDefault
        ? defaultBooks && defaultBooks.length > 0
            ? `当前用年级默认：${orderBooks(scope, defaultBooks).join("、")}`
            : "当前不限册次，全部篇目都可以出题"
        : `当前自选 ${value.length} 册：${orderBooks(scope, value).join("、")}`

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Label>考察范围</Label>
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => onChange(allKeys)}
                        disabled={disabled || allSelected || allKeys.length === 0}
                    >
                        全选
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => onChange([])}
                        disabled={disabled || usingDefault}
                    >
                        跟随年级默认
                    </Button>
                </div>
            </div>

            <p className="text-xs text-muted-foreground">{scopeDefaultHint(scope)}</p>

            <div className="flex flex-wrap gap-2">
                {scope.books.map((book) => {
                    const selected = highlightedSet.has(book.key)
                    return (
                        <button
                            key={book.key}
                            type="button"
                            aria-pressed={selected}
                            disabled={disabled}
                            onClick={() => toggle(book.key)}
                            className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-50",
                                selected
                                    ? "border-[var(--theme-color)] bg-muted/50 font-medium"
                                    : "hover:bg-muted/30"
                            )}
                        >
                            {selected && <Check className="size-3 shrink-0 text-[var(--theme-color)]" />}
                            <span>{book.key}</span>
                            <span className="text-muted-foreground">· {book.count} 篇</span>
                        </button>
                    )
                })}
            </div>

            <p className="text-xs text-muted-foreground">{statusText}</p>

            <p className="text-xs text-muted-foreground">
                至少保留一册；想回到年级默认就点「跟随年级默认」。
            </p>

            {!scope.reciteTagged && (
                <p className="text-xs text-muted-foreground">
                    当前学段还没有标注「{DICTATION_RECITE_TAG}」的篇目，暂不按该标签过滤。
                </p>
            )}
        </div>
    )
}
