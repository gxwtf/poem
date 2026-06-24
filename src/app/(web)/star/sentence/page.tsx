"use client"

import React, { useEffect, useState } from "react"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { queryAllSentenceStars, deleteSentenceStar } from "@/lib/sentence-star"
import useSession from "@/lib/use-session"
import Link from "next/link"
import { toast } from "sonner"

interface SentenceStarItem {
    id: number
    text: string
    charOffset: number
    poemId: string
    createdAt: Date
    poem: {
        title: string
        version: string
        author: string | null
        dynasty: string | null
    }
}

export default function SentenceStarPage() {
    const { session } = useSession()
    const [stars, setStars] = useState<SentenceStarItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!session.isLoggedIn) {
            setLoading(false)
            return
        }
        queryAllSentenceStars(session.userid)
            .then((data) => setStars(data as unknown as SentenceStarItem[]))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [session.isLoggedIn, session.userid])

    const handleDelete = async (id: number) => {
        try {
            await deleteSentenceStar(id)
            setStars(prev => prev.filter(s => s.id !== id))
            toast.success("已取消收藏")
        } catch {
            toast.error("操作失败")
        }
    }

    return (
        <>
            <SiteHeader
                now="句子"
                data={[
                    { name: "古诗文", href: "/overview" },
                    { name: "收藏", href: "/star/poem" }
                ]}
            />
            <div className="max-w-2xl mx-auto">
                {loading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="animate-pulse border-l-2 border-muted pl-4 py-3">
                                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                                <div className="h-3 bg-muted rounded w-1/3" />
                            </div>
                        ))}
                    </div>
                ) : stars.length === 0 ? (
                    <div className="text-center text-muted-foreground py-20">
                        <p className="text-lg">暂无收藏的句子</p>
                        <p className="text-sm mt-2">在古诗文页面选中文本即可划线收藏</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {stars.map(star => (
                            <div
                                key={star.id}
                                className="group relative border-l-2 border-[var(--theme-color)]/30 hover:border-[var(--theme-color)] pl-4 py-2 transition-colors"
                            >
                                <Link
                                    href={`/poem/${star.poem.version}/${star.poem.title}?highlight=${encodeURIComponent(star.text)}&offset=${star.charOffset}`}
                                    className="block"
                                >
                                    <p className="text-base leading-relaxed text-foreground">
                                        {star.text}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1.5 group-hover:text-[var(--theme-color)] transition-colors">
                                        {star.poem.dynasty && <span>——【{star.poem.dynasty}】</span>}
                                        {star.poem.author && <span>{star.poem.author}</span>}
                                        《<span>{star.poem.title}</span>》
                                    </p>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-6 w-6"
                                    onClick={() => handleDelete(star.id)}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}
