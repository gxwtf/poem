import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { SessionData, sessionOptions } from "@/lib/iron"
import { generatePracticeGroup, getOrCreateSettings } from "@/lib/perfect-dictation-service"
import { clampDailyCount, isPracticeMode } from "@/lib/perfect-dictation"

export async function POST(request: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
    if (!session?.isLoggedIn || !session.userid) {
        return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    try {
        const body = await request.json().catch(() => ({}))
        const settings = await getOrCreateSettings(session.userid)
        const mode = isPracticeMode(body?.mode) ? body.mode : settings.mode
        const count =
            typeof body?.count === "number" ? clampDailyCount(body.count) : settings.dailyCount
        const version = session.version === "junior" ? "junior" : "senior"

        const group = await generatePracticeGroup({
            userId: session.userid,
            mode,
            count,
            version,
            grade: session.grade ?? 0,
        })
        return NextResponse.json(group)
    } catch (error) {
        console.error("Error generating perfect dictation group:", error)
        return NextResponse.json({ error: "生成题目失败" }, { status: 500 })
    }
}
