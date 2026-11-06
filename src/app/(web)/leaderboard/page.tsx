import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { LeaderboardList } from "@/components/leaderboard-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { LEADERBOARD_MAX_ROWS } from "@/lib/perfect-dictation"

export const dynamic = "force-dynamic"

// 广学榜完整版（照抄 gxexercise 的 /leaderboard 页面结构）
export default function LeaderboardPage() {
    return (
        <>
            <SiteHeader now="广学榜" />
            <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-8 lg:px-12">
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ChevronLeft className="size-4" />
                        首页
                    </Link>
                    <Separator orientation="vertical" className="h-4" />
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">广学榜</h1>
                    <span className="text-sm text-muted-foreground">
                        完胜默写打卡排行，完整版展示前 {LEADERBOARD_MAX_ROWS} 名
                    </span>
                </div>

                <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
                    <LeaderboardList type="streak" limit={LEADERBOARD_MAX_ROWS} showMe />
                    <LeaderboardList type="total" limit={LEADERBOARD_MAX_ROWS} showMe />
                </div>

                <Card className="mt-8">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">统计规则</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                        <p>
                            <span className="font-medium text-foreground">打卡口径：</span>
                            当天完成过至少一组完胜默写即记 1 天；同一天完成多组只算 1 天（北京时间）。
                        </p>
                        <p>
                            <span className="font-medium text-foreground">勤学榜：</span>
                            按当前连续打卡天数排名；中断一天，连续天数从零重新计算，不影响累计。
                        </p>
                        <p>
                            <span className="font-medium text-foreground">积跬榜：</span>
                            按累计打卡天数排名，练一天算一天。
                        </p>
                        <p>
                            <span className="font-medium text-foreground">排序：</span>
                            主指标相同的情况下，依次比较另一项指标、首次打卡日期、用户 ID。
                        </p>
                        <p>榜单实时计算，刷新页面即为最新结果。</p>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
