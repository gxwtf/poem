import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { SessionData, sessionOptions } from "@/lib/iron"
import { getHomeState, updateSettings } from "@/lib/perfect-dictation-service"

async function getUserId(): Promise<number | null> {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
    if (!session?.isLoggedIn || !session.userid) return null
    return session.userid
}

// 首页完胜默写卡片的状态
export async function GET() {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })

    try {
        const home = await getHomeState(userId)
        return NextResponse.json(home)
    } catch (error) {
        console.error("Error fetching perfect dictation home:", error)
        return NextResponse.json({ error: "获取完胜默写数据失败" }, { status: 500 })
    }
}

// 修改每组题目数量 / 考察方式
export async function PATCH(request: NextRequest) {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })

    try {
        const body = await request.json()
        const settings = await updateSettings(userId, {
            dailyCount: body?.dailyCount,
            mode: body?.mode,
        })
        return NextResponse.json({ settings })
    } catch (error) {
        console.error("Error updating perfect dictation settings:", error)
        return NextResponse.json({ error: "保存设置失败" }, { status: 500 })
    }
}
