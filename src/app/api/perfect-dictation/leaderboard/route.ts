import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { SessionData, sessionOptions } from "@/lib/iron"
import { getLeaderboard } from "@/lib/perfect-dictation-service"
import { isLeaderboardType } from "@/lib/perfect-dictation"

// 完胜默写打卡榜：勤学榜（连续天数）/ 积跬榜（累计天数）。未登录也能看，只是没有「我的排名」
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") ?? "streak"
    if (!isLeaderboardType(type)) {
        return NextResponse.json({ error: "榜单类型不正确" }, { status: 400 })
    }

    const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10)
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined

    let viewerId: number | null = null
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
        const userid = session?.userid
        if (session?.isLoggedIn && typeof userid === "number" && userid > 0) viewerId = userid
    } catch {
        // 会话读取失败按未登录处理，不影响看榜
        viewerId = null
    }

    try {
        const data = await getLeaderboard({ type, viewerId, limit })
        return NextResponse.json(data)
    } catch (error) {
        console.error("Error fetching perfect dictation leaderboard:", error)
        return NextResponse.json({ error: "获取排行榜失败" }, { status: 500 })
    }
}
