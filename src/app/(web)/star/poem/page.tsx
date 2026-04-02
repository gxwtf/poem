// 古诗文概览页面

"use client"
import React, { useEffect, useState } from "react"
import { PoemCard, SkeletonPoemCard } from "@/components/poem-card"
import { useVersion } from "@/components/version-provider"
import { SiteHeader } from "@/components/site-header"
import { queryStars } from "@/lib/star";
import useSession from "@/lib/use-session"

type PoemMeta = {
    id: string
    title: string
    author: string
    dynasty: string
    content: string
    tags?: string[]
    version: string
}

export default function OverviewPage() {
    const { version } = useVersion()
    const [poems, setPoems] = useState<PoemMeta[]>([])
    const [loading, setLoading] = useState(true)
    const { session } = useSession();
    const userId = session.userid;

    useEffect(() => {
        async function loadPoems() {
            setLoading(true)
            try {
                const res = await queryStars(userId);
                // console.log(res);
                const validPoems = res.filter((poem): poem is PoemMeta => poem.id !== undefined);
                setPoems(validPoems);
            } catch (error) {
                console.error('Error fetching poems:', error)
            } finally {
                setLoading(false)
            }
        }
        loadPoems()
    }, [version, userId])

    // 生成骨架屏数组
    const skeletonCount = 8

    if (loading) {
        return (
            <>
                <SiteHeader
                    now="收藏"
                    data={[{ name: "古诗文", href: "/overview" }]}
                />
                <div className="p-2 sm:p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
                    {Array.from({ length: skeletonCount }).map((_, index) => (
                        <SkeletonPoemCard key={index} />
                    ))}
                </div>
            </>
        )
    }

    return (
        <>
            <SiteHeader
                now="收藏"
                data={[{ name: "古诗文", href: "/overview" }]}
            />
            <div className="p-2 sm:p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
                {poems.map((poem) => (
                    <PoemCard
                        key={poem.id}
                        title={poem.title}
                        author={poem.author}
                        dynasty={poem.dynasty}
                        content={poem.content}
                        tags={poem.tags}
                        url={`/poem/${version}/${poem.title}`}
                    />
                ))}
            </div>
        </>
    )
}
