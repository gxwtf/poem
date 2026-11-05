import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { SessionData, sessionOptions } from "@/lib/iron"
import prisma from "@/lib/prisma"
import {
    buildSentenceIndex,
    validateSentence,
    REJECTION_MESSAGES,
    MAX_IMPORT_LINES,
    type PoemSource,
} from "@/lib/mistake-sentence"

const poemSelect = {
    id: true,
    title: true,
    version: true,
    author: true,
    dynasty: true,
} as const

async function getUserId(): Promise<number | null> {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
    if (!session?.isLoggedIn || !session.userid) return null
    return session.userid
}

// 只返回前端需要的字段，避免暴露 userId / normalized 等内部数据
function serializeItem<T extends { id: number; text: string; createdAt: Date; poem: unknown }>(item: T) {
    return { id: item.id, text: item.text, createdAt: item.createdAt, poem: item.poem }
}

// 获取当前用户的错题本
export async function GET() {
    const userId = await getUserId()
    if (!userId) {
        return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    try {
        const items = await prisma.dictationMistake.findMany({
            where: { userId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            include: { poem: { select: poemSelect } },
        })
        return NextResponse.json({ items: items.map(serializeItem) })
    } catch (error) {
        console.error("Error fetching dictation mistakes:", error)
        return NextResponse.json({ error: "获取默写错题本失败" }, { status: 500 })
    }
}

// 批量导入句子（单句输入 / TXT 每行一句）
export async function POST(request: NextRequest) {
    const userId = await getUserId()
    if (!userId) {
        return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    let sentences: string[]
    try {
        const body = await request.json()
        if (!Array.isArray(body?.sentences) || body.sentences.some((s: unknown) => typeof s !== "string")) {
            return NextResponse.json({ error: "参数格式不正确" }, { status: 400 })
        }
        sentences = body.sentences
    } catch {
        return NextResponse.json({ error: "参数格式不正确" }, { status: 400 })
    }

    if (sentences.length === 0) {
        return NextResponse.json({ error: "没有可导入的句子" }, { status: 400 })
    }
    if (sentences.length > MAX_IMPORT_LINES) {
        return NextResponse.json(
            { error: `单次最多导入 ${MAX_IMPORT_LINES} 句` },
            { status: 400 }
        )
    }

    try {
        const poems = (await prisma.poem.findMany({
            select: { ...poemSelect, content: true },
        })) as PoemSource[]
        const index = buildSentenceIndex(poems)

        const rejected: { input: string; reason: string; message: string }[] = []
        const accepted: { text: string; normalized: string; poemId: string }[] = []
        const seen = new Set<string>()

        for (const raw of sentences) {
            const input = raw.trim()
            if (!input) continue

            const result = validateSentence(input, index)
            if (!result.ok) {
                rejected.push({
                    input,
                    reason: result.reason,
                    message: REJECTION_MESSAGES[result.reason],
                })
                continue
            }
            if (seen.has(result.normalized)) {
                rejected.push({
                    input,
                    reason: "duplicate",
                    message: "与本次导入的其它句子重复",
                })
                continue
            }
            seen.add(result.normalized)
            accepted.push({
                text: result.text,
                normalized: result.normalized,
                poemId: result.poem.id,
            })
        }

        // 已在错题本中的句子不重复入库
        const existing = accepted.length
            ? await prisma.dictationMistake.findMany({
                  where: { userId, normalized: { in: accepted.map((a) => a.normalized) } },
                  select: { normalized: true },
              })
            : []
        const existingSet = new Set(existing.map((e) => e.normalized))
        const toCreate: typeof accepted = []
        for (const item of accepted) {
            if (existingSet.has(item.normalized)) {
                rejected.push({
                    input: item.text,
                    reason: "duplicate",
                    message: "已在默写错题本中",
                })
            } else {
                toCreate.push(item)
            }
        }

        if (toCreate.length > 0) {
            await prisma.dictationMistake.createMany({
                data: toCreate.map((item) => ({
                    userId,
                    poemId: item.poemId,
                    text: item.text,
                    normalized: item.normalized,
                })),
                skipDuplicates: true,
            })
        }

        const items = toCreate.length
            ? await prisma.dictationMistake.findMany({
                  where: {
                      userId,
                      normalized: { in: toCreate.map((item) => item.normalized) },
                  },
                  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                  include: { poem: { select: poemSelect } },
              })
            : []

        return NextResponse.json({ items: items.map(serializeItem), rejected })
    } catch (error) {
        console.error("Error importing dictation mistakes:", error)
        return NextResponse.json({ error: "导入失败，请稍后重试" }, { status: 500 })
    }
}

// 多选删除
export async function DELETE(request: NextRequest) {
    const userId = await getUserId()
    if (!userId) {
        return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    let ids: number[]
    try {
        const body = await request.json()
        if (!Array.isArray(body?.ids) || body.ids.some((id: unknown) => typeof id !== "number")) {
            return NextResponse.json({ error: "参数格式不正确" }, { status: 400 })
        }
        ids = body.ids
    } catch {
        return NextResponse.json({ error: "参数格式不正确" }, { status: 400 })
    }

    try {
        const result = await prisma.dictationMistake.deleteMany({
            where: { userId, id: { in: ids } },
        })
        return NextResponse.json({ deleted: result.count })
    } catch (error) {
        console.error("Error deleting dictation mistakes:", error)
        return NextResponse.json({ error: "删除失败" }, { status: 500 })
    }
}
