"use client"

import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Tag } from "@/components/tag"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

interface ArticleCardProps {
    title: string
    author?: string
    dynasty?: string
    views?: number
    abstract?: string
    img?: string
    tags?: string[]
    url: string
}

export function ArticleCard({
    title,
    author,
    dynasty,
    views,
    abstract,
    img,
    tags,
    url
}: ArticleCardProps) {
    const router = useRouter()

    return (
        <Card
            className="rounded-lg overflow-hidden shadow-lg transition-all duration-300 ease-in-out flex flex-col h-full border-t-4 border-[var(--theme-color)] hover:shadow-xl hover:-translate-y-2 cursor-pointer"
            onClick={(e) => {
                if (!(e.target as HTMLElement).closest('.no-navigate')) {
                    router.push(url)
                }
            }}
        >
            <div className="relative h-60 overflow-hidden -mt-6">
                <Image
                    src={img || "https://placehold.co/600x400/f0e6d2/8b4513?text=唐诗意境"}
                    alt={title}
                    fill
                    className="object-cover"
                />
                {tags && tags.length > 0 && (
                    <div className="absolute top-4 right-4 no-navigate">
                        <Tag
                            text={tags[0]}
                            href={`/tag/article/${encodeURIComponent(tags[0])}`}
                        />
                    </div>
                )}
            </div>

            <CardHeader>
                <CardTitle className="text-2xl text-[var(--theme-color)] line-clamp-2">
                    {title}
                </CardTitle>
            </CardHeader>

            <CardContent>
                <div className="line-clamp-4">{abstract}</div>
            </CardContent>

            <CardFooter className="mt-auto">
                <div className="flex justify-between items-center w-full text-gray-500 border-t border-dashed border-gray-200 pt-3">
                    <span>
                        {dynasty && `【${dynasty}】`}
                        <Link
                            href={`/author/${author}`}
                            className="hover:underline underline-offset-4 no-navigate"
                        >
                            {author}
                        </Link>
                    </span>
                    {views && <span>阅读：{views.toLocaleString()}</span>}
                </div>
            </CardFooter>
        </Card>
    )
}

export function SkeletonArticleCard() {
    return (
        <Card className="rounded-lg overflow-hidden shadow-lg flex flex-col h-full border-t-4 border-[var(--theme-color)] border-0 shadow-none">
            <div className="relative h-60 overflow-hidden -mt-6">
                <Skeleton className="h-full w-full" />
            </div>
            <CardHeader>
                <Skeleton className="h-8 w-5/6" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mb-2" />
                <Skeleton className="h-4 w-4/6 mb-2" />
                <Skeleton className="h-4 w-3/6" />
            </CardContent>
            <CardFooter className="mt-auto">
                <div className="flex justify-between items-center w-full">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                </div>
            </CardFooter>
        </Card>
    )
}