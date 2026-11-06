"use client"

import React, { useEffect, useState } from "react"
import { PoemCard, SkeletonPoemCard } from "@/components/poem-card"
import { AuthorCard, SkeletonAuthorCard } from "@/components/author-card"
import { useVersion } from "@/components/version-provider"
import Link from "next/link"

interface RecommendData {
    poems: any[]
    authors: any[]
    articles: any[]
}

export default function Recommends() {
    const { version } = useVersion()
    const [data, setData] = useState<RecommendData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadRecommends() {
            setLoading(true)
            try {
                const response = await fetch(`/api/recommends?version=${version}`)
                if (response.ok) {
                    const result = await response.json()
                    setData(result)
                } else {
                    console.error('Failed to fetch recommends:', response.statusText)
                }
            } catch (error) {
                console.error('Error fetching recommends:', error)
            } finally {
                setLoading(false)
            }
        }
        loadRecommends()
    }, [version])

    if (loading) {
        return (
            <div className="space-y-8">
                {/* 古诗文推荐骨架屏 */}
                <div>
                    <div className="flex justify-between items-center my-4">
                        <h2 className="text-2xl font-bold">古诗文推荐</h2>
                        <Link
                            href={`/overview`}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            查看全部
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <SkeletonPoemCard key={index} />
                        ))}
                    </div>
                </div>

                {/* 作者推荐骨架屏 */}
                <div>
                    <div className="flex justify-between items-center my-4">
                        <h2 className="text-2xl font-bold">作者推荐</h2>
                        <Link
                            href="/authors"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            查看全部
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <SkeletonAuthorCard key={index} />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (!data) {
        return <div className="text-center py-8 text-muted-foreground">暂无推荐数据</div>
    }

    return (
        <div className="space-y-8">
            {/* 古诗文推荐 */}
            <div>
                <div className="flex justify-between items-center my-4">
                    <h2 className="text-2xl font-bold">古诗文推荐</h2>
                    <Link
                        href={`/overview`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        查看全部
                    </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {data.poems.slice(0, 4).map((poem) => (
                        <PoemCard
                            key={poem.id}
                            title={poem.title}
                            author={poem.author}
                            dynasty={poem.dynasty}
                            content={poem.content}
                            tags={poem.tags}
                            url={`/poem/${poem.version}/${poem.title}`}
                        />
                    ))}
                </div>
            </div>

            {/* 作者推荐 */}
            <div>
                <div className="flex justify-between items-center my-4">
                    <h2 className="text-2xl font-bold">作者推荐</h2>
                    <Link
                        href="/authors"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        查看全部
                    </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {data.authors.slice(0, 3).map((author) => (
                        <AuthorCard
                            key={author.id}
                            name={author.name}
                            epithet={author.epithet}
                            intro={author.intro}
                            quote={author.quote}
                            tags={author.tags}
                            url={`/author/${author.name}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}