"use client"

import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Highlighter, X } from "lucide-react"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import { toggleSentenceStar, querySentenceStarsByPoem, deleteSentenceStar } from "@/lib/sentence-star"
import { queryPoemId } from "@/lib/star"
import useSession from "@/lib/use-session"
import { toast } from "sonner"
import { MemorizeContext } from "@/components/poem-preview/memorize-context"

interface AnchorRect {
    x: number
    y: number
    width: number
    height: number
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

/** 清除容器内所有 [data-char] 上的高亮属性 */
function clearHighlightAttrs(container: HTMLElement) {
    container.querySelectorAll("[data-char][data-highlight-id]").forEach((el) => {
        if (el instanceof HTMLElement) {
            delete el.dataset.highlightId
            delete el.dataset.charOffset
            el.classList.remove("sentence-highlight-active")
        }
    })
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
    const [toolbarAnchor, setToolbarAnchor] = useState<AnchorRect | null>(null)
    const [selectedText, setSelectedText] = useState("")
    const [selectedCharOffset, setSelectedCharOffset] = useState(0)
    const [highlights, setHighlights] = useState<HighlightData[]>([])
    const [poemId, setPoemId] = useState<string>("")
    const [activeHighlight, setActiveHighlight] = useState<number | null>(null)
    const [popoverAnchor, setPopoverAnchor] = useState<AnchorRect | null>(null)
    const { session } = useSession()
    const { memorize } = useContext(MemorizeContext)
    const searchParams = useSearchParams()
    const scrollToText = searchParams.get("highlight")
    const scrollOffset = searchParams.get("offset")

    // 用 ref 存储 memorize 状态，使旧闭包也能获取最新值，防止 rAF 调度的旧 applyHighlights 重新应用高亮
    const memorizeModeRef = useRef(false)
    memorizeModeRef.current = !isNaN(memorize)

    // 背诵模式下不应用高亮（避免手动 DOM 操作与 React 冲突导致崩溃）
    const activeHighlights = isNaN(memorize) ? highlights : []

    // 背诵模式切换时，同步清除高亮属性
    useLayoutEffect(() => {
        const container = containerRef.current
        if (!container) return
        if (!isNaN(memorize)) {
            observerRef.current?.disconnect()
            clearHighlightAttrs(container)
        }
    }, [memorize])

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

    // 应用高亮到 DOM：直接在 [data-char] 元素上添加 data-highlight-id 属性
    // 不再插入包裹 span，避免 Safari 中 display:inline/contents 在 flex 容器内的渲染异常
    const applyHighlights = useCallback(() => {
        const container = containerRef.current
        if (!container) return

        // 断开 observer 防止无限循环
        observerRef.current?.disconnect()

        // 背诵模式下只清除高亮属性，不重新应用
        // 检查全局标志（在 setMemorize 之前同步设置）和 ref（渲染阶段更新）
        // 同时检查 __poemHighlightSuspended（showNotes 变化时设置）
        const w = window as unknown as Record<string, unknown>
        if (w.__poemMemorizeMode || w.__poemHighlightSuspended || memorizeModeRef.current) {
            clearHighlightAttrs(container)
            // __poemHighlightSuspended 是一次性的：React re-render 完成后清除，下一帧重新应用高亮
            if (w.__poemHighlightSuspended) {
                delete w.__poemHighlightSuspended
                requestAnimationFrame(() => applyHighlights())
            }
            observerRef.current?.observe(container, { childList: true, subtree: true })
            return
        }

        // 先清除已有高亮属性
        clearHighlightAttrs(container)

        if (activeHighlights.length === 0) {
            observerRef.current?.observe(container, { childList: true, subtree: true })
            return
        }

        const { els, text } = getCharElements(container)
        if (!text) {
            observerRef.current?.observe(container, { childList: true, subtree: true })
            return
        }

        // 计算期望的高亮映射
        // 优先用 charOffset 精确定位；若校验失败（charOffset 因历史数据/渲染差异而偏移），回退到 indexOf
        const charHighlightMap = new Map<number, number>()
        for (const highlight of activeHighlights) {
            let idx = highlight.charOffset
            if (idx < 0 || idx + highlight.text.length > text.length ||
                text.substring(idx, idx + highlight.text.length) !== highlight.text) {
                // charOffset 不匹配，回退到 indexOf 查找
                idx = text.indexOf(highlight.text)
                if (idx === -1) continue
            }
            for (let i = idx; i < idx + highlight.text.length; i++) {
                charHighlightMap.set(i, highlight.id)
            }
        }

        // 直接在 [data-char] 元素上设置属性（不移动 DOM）
        for (let i = 0; i < els.length; i++) {
            const hid = charHighlightMap.get(i)
            if (hid !== undefined) {
                els[i].dataset.highlightId = String(hid)
                els[i].dataset.charOffset = String(activeHighlights.find(h => h.id === hid)?.charOffset ?? 0)
            }
        }

        // 计算波浪线相位偏移，确保相邻字符之间波浪线相位对齐
        if (containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect()
            for (let i = 0; i < els.length; i++) {
                if (!charHighlightMap.has(i)) continue
                const charRect = els[i].getBoundingClientRect()
                const offset = charRect.left - containerRect.left
                els[i].style.setProperty("--wave-offset", `${Math.round(offset) % 20}px`)
            }
        }

        // 重连 observer
        observerRef.current?.observe(container, { childList: true, subtree: true })
    }, [activeHighlights])

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

    // 从收藏页/默写页跳转时自动滚动定位（仅首次加载；offset 优先，否则按 highlight 文本匹配）
    const hasScrolledRef = useRef(false)
    useEffect(() => {
        if (!scrollToText || hasScrolledRef.current) return
        let attempts = 0
        let timer: ReturnType<typeof setTimeout> | undefined

        // 按 highlight 文本匹配：忽略标点/分行差异，只比较汉字数字序列
        const locateByText = (): boolean => {
            const container = containerRef.current
            if (!container) return false
            const { els } = getCharElements(container)
            const norm = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, '')
            const target = norm(scrollToText)
            if (!target) return false
            const idxMap: number[] = []
            let normText = ''
            els.forEach((el, i) => {
                const c = norm(el.dataset.char ?? '')
                if (c) {
                    normText += c
                    idxMap.push(i)
                }
            })
            const idx = normText.indexOf(target)
            if (idx === -1) return false
            const first = idxMap[idx]
            const last = idxMap[idx + target.length - 1]
            for (let k = first; k <= last; k++) {
                els[k].classList.add("jump-highlight")
            }
            els[first].scrollIntoView({ behavior: "smooth", block: "center" })
            return true
        }

        const run = () => {
            const container = containerRef.current
            if (container) {
                if (scrollOffset !== null) {
                    const el = container.querySelector(`[data-char][data-char-offset="${scrollOffset}"]`)
                    if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" })
                        hasScrolledRef.current = true
                        return
                    }
                }
                if (locateByText()) {
                    hasScrolledRef.current = true
                    return
                }
            }
            // 诗文尚未渲染完成，等待后重试
            if (++attempts < 20) {
                timer = setTimeout(run, 300)
            } else {
                hasScrolledRef.current = true
            }
        }
        run()
        return () => clearTimeout(timer)
    }, [scrollToText, scrollOffset])

    // 监听文本选择和点击
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleMouseUp = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (target.closest("[data-slot='popover-content']")) return

            const selection = window.getSelection()
            if (!selection || selection.isCollapsed || !selection.toString().trim()) {
                setToolbarAnchor(null)
                setSelectedText("")
                return
            }

            const range = selection.getRangeAt(0)
            if (!container.contains(range.commonAncestorContainer)) {
                setToolbarAnchor(null)
                setSelectedText("")
                return
            }

            const text = selection.toString().trim().replace(/[\n\r]+/g, "")
            if (!text) {
                setToolbarAnchor(null)
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
                setToolbarAnchor(null)
                setSelectedText("")
                return
            }

            const rect = range.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            setToolbarAnchor({ x: rect.left - containerRect.left, y: rect.top - containerRect.top, width: rect.width, height: rect.height })
            setSelectedText(text)
            setSelectedCharOffset(startIdx)
        }

        const handleMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement

            // 不在 Popover 内点击时才处理
            if (target.closest("[data-slot='popover-content']")) return

            // 点击高亮字符时显示管理弹窗
            const highlightEl = target.closest("[data-highlight-id]") as HTMLElement | null
            if (highlightEl && highlightEl.dataset.highlightId) {
                const id = highlightEl.dataset.highlightId
                // 计算所有同组 [data-char] 元素的包围矩形
                const charEls = container.querySelectorAll(`[data-char][data-highlight-id="${id}"]`)
                let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
                charEls.forEach(el => {
                    const r = el.getBoundingClientRect()
                    left = Math.min(left, r.left)
                    top = Math.min(top, r.top)
                    right = Math.max(right, r.right)
                    bottom = Math.max(bottom, r.bottom)
                })
                const containerRect = container.getBoundingClientRect()
                setActiveHighlight(Number(id))
                setPopoverAnchor({ x: left - containerRect.left, y: top - containerRect.top, width: right - left, height: bottom - top })
                return
            }

            // 点击其他区域时关闭工具栏和弹窗
            // 只清除控制 open 的状态，保留 anchor 位置避免关闭动画时 Popover 跳到 (0,0)
            setSelectedText("")
            setActiveHighlight(null)
        }

        // hover 时高亮同组所有字符
        const handleMouseEnter = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest("[data-highlight-id]") as HTMLElement | null
            if (!target || !target.dataset.highlightId) return
            const id = target.dataset.highlightId
            container.querySelectorAll(`[data-char][data-highlight-id="${id}"]`).forEach(el => {
                el.classList.add("sentence-highlight-active")
            })
        }

        const handleMouseLeave = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest("[data-highlight-id]") as HTMLElement | null
            if (!target || !target.dataset.highlightId) return
            const id = target.dataset.highlightId
            container.querySelectorAll(`[data-char][data-highlight-id="${id}"]`).forEach(el => {
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
        } catch {
            toast.error("操作失败")
        }
    }

    return (
        <div ref={containerRef} className="relative">
            {children}

            {/* 选区工具栏 */}
            <Popover
                open={selectedText !== ""}
                onOpenChange={(open) => { if (!open) setSelectedText("") }}
            >
                <PopoverAnchor asChild>
                    <div style={{
                        position: "absolute",
                        left: toolbarAnchor?.x ?? 0,
                        top: toolbarAnchor?.y ?? 0,
                        width: toolbarAnchor?.width ?? 0,
                        height: toolbarAnchor?.height ?? 0,
                        pointerEvents: "none"
                    }} />
                </PopoverAnchor>
                <PopoverContent side="top" align="center" sideOffset={8} className="w-auto p-1.5 data-[state=closed]:!animate-none">
                    <button
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                        onClick={handleHighlight}
                    >
                        <Highlighter className="w-3.5 h-3.5" />
                        划线
                    </button>
                </PopoverContent>
            </Popover>

            {/* 高亮管理弹窗 */}
            <Popover
                open={activeHighlight !== null}
                onOpenChange={(open) => { if (!open) setActiveHighlight(null) }}
            >
                <PopoverAnchor asChild>
                    <div style={{
                        position: "absolute",
                        left: popoverAnchor?.x ?? 0,
                        top: popoverAnchor?.y ?? 0,
                        width: popoverAnchor?.width ?? 0,
                        height: popoverAnchor?.height ?? 0,
                        pointerEvents: "none"
                    }} />
                </PopoverAnchor>
                <PopoverContent side="top" align="center" sideOffset={8} className="w-auto p-1.5 data-[state=closed]:!animate-none">
                    <button
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                        onClick={() => handleUnstar(activeHighlight!)}
                    >
                        <X className="w-3.5 h-3.5" />
                        取消收藏
                    </button>
                </PopoverContent>
            </Popover>
        </div>
    )
}
