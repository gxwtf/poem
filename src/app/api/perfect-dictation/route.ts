import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession, type IronSession } from "iron-session"
import { SessionData, sessionOptions } from "@/lib/iron"
import { getHomeState, updateSettings } from "@/lib/perfect-dictation-service"

interface Auth {
    session: IronSession<SessionData>
    userId: number
    version: string
    grade: number
}

async function requireAuth(): Promise<Auth | null> {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
    const userId = session?.userid
    if (!session?.isLoggedIn || typeof userId !== "number" || userId <= 0) return null
    return {
        session,
        userId,
        version: session.version === "junior" ? "junior" : "senior",
        grade: session.grade ?? 0,
    }
}

// 首页完胜默写卡片的状态（含本次出题范围）
export async function GET() {
    const auth = await requireAuth()
    if (!auth) return NextResponse.json({ error: "未登录" }, { status: 401 })

    try {
        const home = await getHomeState(auth.userId, {
            version: auth.version,
            grade: auth.grade,
        })
        return NextResponse.json(home)
    } catch (error) {
        console.error("Error fetching perfect dictation home:", error)
        return NextResponse.json({ error: "获取完胜默写数据失败" }, { status: 500 })
    }
}

// 修改每组题目数量 / 考察方式 / 考察范围（册次）
export async function PATCH(request: NextRequest) {
    const auth = await requireAuth()
    if (!auth) return NextResponse.json({ error: "未登录" }, { status: 401 })

    try {
        const body = await request.json()
        const settings = await updateSettings(
            auth.userId,
            {
                dailyCount: body?.dailyCount,
                mode: body?.mode,
                books: body?.books,
            },
            auth.version
        )
        return NextResponse.json({ settings })
    } catch (error) {
        console.error("Error updating perfect dictation settings:", error)
        return NextResponse.json({ error: "保存设置失败" }, { status: 500 })
    }
}
