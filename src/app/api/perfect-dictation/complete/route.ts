import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { SessionData, sessionOptions } from "@/lib/iron"
import {
    InvalidPracticeResultError,
    completePracticeGroup,
} from "@/lib/perfect-dictation-service"
import { isPracticeMode, type CompleteQuestionResult } from "@/lib/perfect-dictation"

export async function POST(request: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
    if (!session?.isLoggedIn || !session.userid) {
        return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    try {
        const body = await request.json().catch(() => ({}))
        if (!isPracticeMode(body?.mode)) {
            return NextResponse.json({ error: "考察方式不正确" }, { status: 400 })
        }
        if (!Array.isArray(body?.results)) {
            return NextResponse.json({ error: "作答记录不正确" }, { status: 400 })
        }

        const result = await completePracticeGroup({
            userId: session.userid,
            mode: body.mode,
            results: body.results as CompleteQuestionResult[],
        })
        return NextResponse.json(result)
    } catch (error) {
        if (error instanceof InvalidPracticeResultError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error("Error completing perfect dictation group:", error)
        return NextResponse.json({ error: "保存本组结果失败" }, { status: 500 })
    }
}
