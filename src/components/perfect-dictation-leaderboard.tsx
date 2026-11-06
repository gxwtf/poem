import Link from "next/link"

import { LeaderboardList } from "@/components/leaderboard-list"
import { LEADERBOARD_HOME_LIMIT } from "@/lib/perfect-dictation"

/**
 * 首页「广学榜」区块（照抄 gxexercise 首页的广学榜版块）：
 * 两个榜各展示前 5 名 + 「查看完整榜单」链接到 /leaderboard。
 */
export default function PerfectDictationLeaderboard() {
    return (
        <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-bold text-foreground">广学榜</h2>
                <Link
                    href="/leaderboard"
                    className="text-sm font-medium text-[var(--theme-color)] hover:underline"
                >
                    查看完整榜单 →
                </Link>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                <LeaderboardList type="streak" limit={LEADERBOARD_HOME_LIMIT} compact />
                <LeaderboardList type="total" limit={LEADERBOARD_HOME_LIMIT} compact />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
                统计规则：当天完成过至少一组完胜默写即记 1 天，同一天多组只算一次；勤学榜按当前连续天数排名（中断一天从零重算，不影响累计），积跬榜按累计天数排名。
            </p>
        </section>
    )
}
