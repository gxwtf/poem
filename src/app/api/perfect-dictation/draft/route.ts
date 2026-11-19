import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { SessionData, sessionOptions } from "@/lib/iron"
import { deleteDraft, getDraft, saveDraft } from "@/lib/perfect-dictation-service"
import {
    isPracticeMode,
    type DraftAnswer,
    type PracticeQuestion,
} from "@/lib/perfect-dictation"

const MAX_ITEMS = 50

async function requireAuth(): Promise<number | null> {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
    const userId = session?.userid
    if (!session?.isLoggedIn || typeof userId !== "number" || userId <= 0) return null
    return userId
}

// 读取未完成的作答草稿；没有时返回 null（200）
export async function GET() {
    const userId = await requireAuth()
    if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })
    try {
        const draft = await getDraft(userId)
        return NextResponse.json(draft)
    } catch (error) {
        console.error("Error fetching dictation draft:", error)
        return NextResponse.json({ error: "获取作答记录失败" }, { status: 500 })
    }
}

// 保存/覆盖未完成的作答草稿（每答一题调用一次）
export async function PUT(request: NextRequest) {
    const userId = await requireAuth()
    if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })
    try {
        const body = await request.json().catch(() => ({}))
        const mode = isPracticeMode(body?.mode) ? body.mode : null
        if (!mode) return NextResponse.json({ error: "考察方式不正确" }, { status: 400 })
        if (!Array.isArray(body?.questions) || !Array.isArray(body?.results)) {
            return NextResponse.json({ error: "作答记录不正确" }, { status: 400 })
        }
        if (body.questions.length > MAX_ITEMS || body.results.length > MAX_ITEMS) {
            return NextResponse.json({ error: "题目过多" }, { status: 400 })
        }
        if (body.results.length > body.questions.length) {
            return NextResponse.json({ error: "作答记录不正确" }, { status: 400 })
        }

        await saveDraft(userId, {
            mode,
            questions: body.questions as PracticeQuestion[],
            results: body.results as DraftAnswer[],
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Error saving dictation draft:", error)
        return NextResponse.json({ error: "保存作答记录失败" }, { status: 500 })
    }
}

// 清除未完成的作答草稿（放弃重来 / 设置变更时由设置接口处理）
export async function DELETE() {
    const userId = await requireAuth()
    if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })
    try {
        await deleteDraft(userId)
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Error deleting dictation draft:", error)
        return NextResponse.json({ error: "清除作答记录失败" }, { status: 500 })
    }
}
