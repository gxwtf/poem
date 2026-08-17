"use client"

import {
    Card,
    CardContent,
    CardFooter,
} from "@/components/ui/card"
import { useRouter } from "next/navigation";

interface PoemQuoteCardProps {
    title: string
    version: string
    author: string
    dynasty?: string
    quote: string
    href?: string // 指定时优先于默认的相对跳转
    unlinked?: boolean // 为 true 时不跳转
    quoteExtra?: React.ReactNode // 正文下方附加内容
    footerExtra?: React.ReactNode // 页脚左侧附加内容
    footerNote?: React.ReactNode // 替代默认出处行
}

export function PoemQuoteCard({
    title,
    version,
    author,
    dynasty,
    quote,
    href,
    unlinked,
    quoteExtra,
    footerExtra,
    footerNote
}: PoemQuoteCardProps) {
    const router = useRouter()
    return (
        <Card
            className={`border-l-4 border-l-[var(--theme-color)] ${unlinked ? '' : 'cursor-pointer'}`}
            onClick={(e) => {
                if (unlinked) return
                if (!(e.target as HTMLElement).closest('.no-navigate')) {
                    router.push(href || `../${version}/${title}`)
                }
            }}
        >
            <CardContent className="truncate text-lg">{quote}</CardContent>
            {quoteExtra && <CardContent className="text-sm text-muted-foreground -mt-3">{quoteExtra}</CardContent>}
            <CardFooter className="truncate text-sm text-muted-foreground mt-auto justify-end">
                {footerExtra && <div className="mr-auto no-navigate truncate">{footerExtra}</div>}
                {footerNote ? footerNote : <>——{dynasty ? `【${dynasty}】` : ""}{author}《{title}》</>}
            </CardFooter>
        </Card>
    )
}

export function PoemQuoteCards({ poems }: { poems: Array<PoemQuoteCardProps> }) {
  if (!poems || poems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无推荐内容
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {poems.map((poem, index) => (
        <PoemQuoteCard
          key={index}
          title={poem.title}
          version={poem.version}
          author={poem.author}
          dynasty={poem.dynasty}
          quote={poem.quote}
        />
      ))}
    </div>
  );
}

export function SkeletonPoemQuoteCard() {
    return (
        <Card className="border-l-4 border-l-[var(--theme-color)]">
            <CardContent>
                <div className="h-4 w-full bg-muted rounded mb-2" />
                <div className="h-4 w-5/6 bg-muted rounded mb-2" />
                <div className="h-4 w-4/6 bg-muted rounded" />
            </CardContent>
            <CardFooter className="text-right">
                <div className="h-4 w-2/3 bg-muted rounded" />
            </CardFooter>
        </Card>
    )
}