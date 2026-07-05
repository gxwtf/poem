"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "next/navigation"
import { Highlighter, X } from "lucide-react"
import { toggleSentenceStar, querySentenceStarsByPoem, deleteSentenceStar } from "@/lib/sentence-star"
import { queryPoemId } from "@/lib/star"
import useSession from "@/lib/use-session"
import { toast } from "sonner"

interface ToolbarPosition {
    x: number
    y: number
}

interface HighlightData {
    id: number
    text: string
    charOffset: number
}

interface TextHighlighterProps {
    children: React.ReactNode
    version: string
    title: string
}

/** 获取容器内所有 [data-char] 元素及其拼接文本 */
function getCharElements(container: HTMLElement): { els: HTMLElement[]; text: string } {
    const els = Array.from(container.querySelectorAll("[data-char]")) as HTMLElement[]
    const text = els.map(el => el.dataset.char ?? "").join("")
    return { els, text }
}

export function TextHighlighter({ children, version, title }: TextHighlighterProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const observerRef = useRef<MutationObserver | null>(null)
    const [toolbarPos, setToolbarPos] = useState<ToolbarPosition | null>(null)
    const [selectedText, setSelectedText] = useState("")
    const [selectedCharOffset, setSelectedCharOffset] = useState(0)
    const [highlights, setHighlights] = useState<HighlightData[]>([])
    const [poemId, setPoemId] = useState<string>("")
    const [activeHighlight, setActiveHighlight] = useState<number | null>(null)
    const [popoverPos, setPopoverPos] = useState<ToolbarPosition | null>(null)
    const { session } = useSession()
    const searchParams = useSearchParams()
    const scrollToText = searchParams.get("highlight")
    const scrollOffset = searchParams.get("offset")

    // 获取 poemId
    useEffect(() => {
        queryPoemId(version, title).then(setPoemId).catch(() => {})
    }, [version, title])

    // 加载已有高亮
    useEffect(() => {
        if (!poemId) return
        // 直接从 API 获取 session 状态，避免 SWR 缓存问题
        const loadHighlights = async () => {
            try {
                const res = await fetch("/api/session", {
                    headers: { accept: "application/json", "content-type": "application/json" }
                })
                const data = await res.json()
                if (!data.isLoggedIn) return
                const stars = await querySentenceStarsByPoem(data.userid, poemId) as unknown as { id: number; text: string; charOffset: number }[]
                setHighlights(stars.map(s => ({ id: s.id, text: s.text, charOffset: s.charOffset })))
            } catch {
                // ignore
            }
        }
        loadHighlights()
    }, [poemId])

    // 应用高亮到 DOM：用 span 包裹高亮字符（避免 React 重渲染清除 class）
    // 关键：按相同父元素拆分组，避免跨父元素移动字符破坏 DOM 结构
    const applyHighlights = useCallback(() => {
        const container = containerRef.current
        if (!container) return

        // 断开 observer 防止无限循环（applyHighlights 修改 DOM 会触发 observer）
        observerRef.current?.disconnect()

        // 先清除已有高亮包裹
        container.querySelectorAll(".sentence-highlight").forEach((wrap) => {
            const parent = wrap.parentNode
            if (parent) {
                while (wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap)
                parent.removeChild(wrap)
            }
        })

        if (highlights.length === 0) {
            observerRef.current?.observe(container, { childList: true, subtree: true })
            return
        }

        const { els, text } = getCharElements(container)
        if (!text) {
            observerRef.current?.observe(container, { childList: true, subtree: true })
            return
        }

        // 计算期望的高亮映射（使用 charOffset 精确定位，而非 indexOf）
        const charHighlightMap = new Map<number, number>()
        for (const highlight of highlights) {
            const idx = highlight.charOffset
            // 校验：charOffset 位置的文本必须匹配
            if (idx < 0 || idx + highlight.text.length > text.length) continue
            if (text.substring(idx, idx + highlight.text.length) !== highlight.text) continue
            for (let i = idx; i < idx + highlight.text.length; i++) {
                charHighlightMap.set(i, highlight.id)
            }
        }

        // 按连续的 highlightId 且相同父元素 分组
        // 同一高亮跨越不同父元素（如 WordNotePopover）时，拆分为多个子组
        const groups: { startIdx: number; endIdx: number; highlightId: number; parent: Node }[] = []
        let currentId: number | null = null
        let currentParent: Node | null = null
        let groupStart = -1

        for (let i = 0; i <= els.length; i++) {
            const hid = i < els.length ? (charHighlightMap.get(i) ?? null) : null
            const parent = i < els.length ? els[i].parentNode : null
            if (hid !== currentId || parent !== currentParent) {
                if (currentId !== null && currentParent !== null) {
                    groups.push({ startIdx: groupStart, endIdx: i - 1, highlightId: currentId, parent: currentParent })
                }
                currentId = hid
                currentParent = parent
                groupStart = i
            }
        }

        // 从后往前包裹，避免索引偏移
        for (let g = groups.length - 1; g >= 0; g--) {
            const group = groups[g]
            const wrap = document.createElement("span")
            wrap.className = "sentence-highlight"
            wrap.dataset.highlightId = String(group.highlightId)
            wrap.dataset.charOffset = String(highlights.find(h => h.id === group.highlightId)?.charOffset ?? 0)

            // 保存插入位置（在移动元素之前）
            const nextInParent = els[group.endIdx].nextSibling

            for (let i = group.startIdx; i <= group.endIdx; i++) {
                wrap.appendChild(els[i])
            }

            group.parent.insertBefore(wrap, nextInParent)

            // 计算波浪线相位偏移，确保相邻字符之间波浪线相位对齐
            // 每个字符根据自己的 left 位置对波浪周期(20px)取模
            if (containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect()
                wrap.querySelectorAll("[data-char]").forEach((char) => {
                    const charRect = char.getBoundingClientRect()
                    const offset = charRect.left - containerRect.left
                    if (char instanceof HTMLElement) {
                        char.style.setProperty("--wave-offset", `${Math.round(offset) % 20}px`)
                    }
                })
            }
        }

        // 重连 observer
        observerRef.current?.observe(container, { childList: true, subtree: true })
    }, [highlights])

    // 首次应用及 highlights 变化时应用
    useEffect(() => {
        applyHighlights()
    }, [applyHighlights])

    // MutationObserver：React 重渲染可能替换 Char 元素，需要重新包裹
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let rafId: number | null = null

        const observer = new MutationObserver((mutations) => {
            // 仅在 childList 变化时重新应用（React 替换了 DOM 节点）
            const hasChildListChange = mutations.some(m => m.type === "childList")
            if (!hasChildListChange) return

            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
                applyHighlights()
                rafId = null
            })
        })

        observerRef.current = observer
        observer.observe(container, { childList: true, subtree: true })

        return () => {
            observer.disconnect()
            observerRef.current = null
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [applyHighlights])

    // 从收藏页跳转时自动滚动到高亮句子（仅首次加载，等 highlights 就绪后执行一次）
    const hasScrolledRef = useRef(false)
    useEffect(() => {
        if (!scrollToText || hasScrolledRef.current) return
        if (highlights.length === 0) return // 等数据加载完
        hasScrolledRef.current = true
        const timer = setTimeout(() => {
            if (scrollOffset !== null) {
                const offset = parseInt(scrollOffset, 10)
                const el = containerRef.current?.querySelector(`.sentence-highlight[data-char-offset="${offset}"]`)
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" })
                    return
                }
            }
            const el = containerRef.current?.querySelector(`.sentence-highlight[data-highlight-id]`)
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" })
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [scrollToText, scrollOffset, highlights])

    // 监听文本选择和点击
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleMouseUp = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (target.closest(".highlight-popover") || target.closest(".selection-toolbar")) return

            const selection = window.getSelection()
            if (!selection || selection.isCollapsed || !selection.toString().trim()) {
                setToolbarPos(null)
                setSelectedText("")
                return
            }

            const range = selection.getRangeAt(0)
            if (!container.contains(range.commonAncestorContainer)) {
                setToolbarPos(null)
                setSelectedText("")
                return
            }

            const text = selection.toString().trim().replace(/[\n\r]+/g, "")
            if (!text) {
                setToolbarPos(null)
                setSelectedText("")
                return
            }

            // 仅在正文中允许划线（选区的起止必须都在 [data-char] 元素内）
            const { els } = getCharElements(container)
            let startIdx = -1
            const rangeStart = range.startContainer
            for (let i = 0; i < els.length; i++) {
                if (els[i].contains(rangeStart) || els[i] === rangeStart) {
                    startIdx = i
                    break
                }
            }
            const rangeEnd = range.endContainer
            let endIdx = -1
            for (let i = 0; i < els.length; i++) {
                if (els[i].contains(rangeEnd) || els[i] === rangeEnd) {
                    endIdx = i
                    break
                }
            }
            if (startIdx === -1 || endIdx === -1) {
                setToolbarPos(null)
                setSelectedText("")
                return
            }

            const rect = range.getBoundingClientRect()
            setToolbarPos({
                x: rect.left + rect.width / 2,
                y: rect.top - 8
            })
            setSelectedText(text)
            setSelectedCharOffset(startIdx)
        }

        const handleMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement

            // 点击高亮字符时显示管理弹窗
            const highlightEl = target.closest(".sentence-highlight") as HTMLElement | null
            if (highlightEl && highlightEl.dataset.highlightId) {
                const id = Number(highlightEl.dataset.highlightId)
                if (id) {
                    const rect = highlightEl.getBoundingClientRect()
                    setActiveHighlight(id)
                    setPopoverPos({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8
                    })
                }
                return
            }

            if (!target.closest(".highlight-popover") && !target.closest(".selection-toolbar")) {
                setToolbarPos(null)
                setSelectedText("")
                setActiveHighlight(null)
                setPopoverPos(null)
            }
        }

        // hover 时高亮同组所有字符
        const handleMouseEnter = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest(".sentence-highlight") as HTMLElement | null
            if (!target || !target.dataset.highlightId) return
            const id = target.dataset.highlightId
            container.querySelectorAll(`.sentence-highlight[data-highlight-id="${id}"]`).forEach(el => {
                el.classList.add("sentence-highlight-active")
            })
        }

        const handleMouseLeave = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest(".sentence-highlight") as HTMLElement | null
            if (!target || !target.dataset.highlightId) return
            const id = target.dataset.highlightId
            container.querySelectorAll(`.sentence-highlight[data-highlight-id="${id}"]`).forEach(el => {
                el.classList.remove("sentence-highlight-active")
            })
        }

        // 使用事件委托
        container.addEventListener("mouseup", handleMouseUp)
        document.addEventListener("mousedown", handleMouseDown)
        container.addEventListener("mouseover", handleMouseEnter)
        container.addEventListener("mouseout", handleMouseLeave)
        return () => {
            container.removeEventListener("mouseup", handleMouseUp)
            document.removeEventListener("mousedown", handleMouseDown)
            container.removeEventListener("mouseover", handleMouseEnter)
            container.removeEventListener("mouseout", handleMouseLeave)
        }
    }, [])

    // 划线（收藏）操作
    const handleHighlight = async () => {
        // 直接从 API 获取最新 session 状态，避免 SWR 缓存问题
        let userId = session.userid
        let loggedIn = session.isLoggedIn
        if (!loggedIn) {
            try {
                const res = await fetch("/api/session", {
                    headers: { accept: "application/json", "content-type": "application/json" }
                })
                const data = await res.json()
                loggedIn = data.isLoggedIn
                userId = data.userid
            } catch {
                // ignore
            }
        }
        if (!loggedIn) {
            toast.error("请先登录")
            return
        }
        if (!poemId || !selectedText) return

        try {
            const starred = await toggleSentenceStar(userId, poemId, selectedText, selectedCharOffset)
            if (starred) {
                toast.success("已划线收藏")
                const stars = await querySentenceStarsByPoem(userId, poemId) as unknown as { id: number; text: string; charOffset: number }[]
                setHighlights(stars.map(s => ({ id: s.id, text: s.text, charOffset: s.charOffset })))
            } else {
                toast.info("已取消划线")
                setHighlights(prev => prev.filter(h => h.text !== selectedText || h.charOffset !== selectedCharOffset))
            }
        } catch {
            toast.error("操作失败")
        }
        setToolbarPos(null)
        setSelectedText("")
        window.getSelection()?.removeAllRanges()
    }

    // 取消收藏
    const handleUnstar = async (id: number) => {
        try {
            await deleteSentenceStar(id)
            toast.success("已取消收藏")
            setHighlights(prev => prev.filter(h => h.id !== id))
            setActiveHighlight(null)
            setPopoverPos(null)
        } catch {
            toast.error("操作失败")
        }
    }

    return (
        <div ref={containerRef} className="relative">
            {children}

            {/* 选区工具栏 */}
            {toolbarPos && selectedText && createPortal(
                <div
                    className="selection-toolbar fixed z-50"
                    style={{
                        left: toolbarPos.x,
                        top: toolbarPos.y,
                        transform: "translate(-50%, -100%)"
                    }}
                >
                    <div className="rounded-lg border shadow-lg bg-background p-1.5">
                        <button
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                            onClick={handleHighlight}
                        >
                            <Highlighter className="w-3.5 h-3.5" />
                            划线
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* 高亮管理弹窗 - 使用简单浮动面板替代 Popover */}
            {activeHighlight !== null && popoverPos && createPortal(
                <div
                    className="highlight-popover fixed z-50"
                    style={{
                        left: popoverPos.x,
                        top: popoverPos.y,
                        transform: "translate(-50%, -100%)"
                    }}
                >
                    <div className="rounded-lg border shadow-lg bg-background p-1.5">
                        <button
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                            onClick={() => handleUnstar(activeHighlight)}
                        >
                            <X className="w-3.5 h-3.5" />
                            取消收藏
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
