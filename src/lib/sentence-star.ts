"use server"

import prisma from "@/lib/prisma"

/** 查询用户是否已收藏某句子 */
export const querySentenceStar = async (userId: number, poemId: string, text: string, charOffset: number): Promise<boolean> => {
    const res = await prisma.sentenceStar.findUnique({
        where: {
            userId_poemId_text_charOffset: { userId, poemId, text, charOffset }
        }
    })
    return !!res
}

/** 切换句子收藏状态，返回收藏后的状态 */
export const toggleSentenceStar = async (userId: number, poemId: string, text: string, charOffset: number): Promise<boolean> => {
    const existing = await prisma.sentenceStar.findUnique({
        where: {
            userId_poemId_text_charOffset: { userId, poemId, text, charOffset }
        }
    })
    if (existing) {
        await prisma.sentenceStar.delete({ where: { id: existing.id } })
        return false
    }
    await prisma.sentenceStar.create({
        data: { userId, poemId, text, charOffset }
    })
    return true
}

/** 删除句子收藏 */
export const deleteSentenceStar = async (id: number): Promise<void> => {
    await prisma.sentenceStar.delete({ where: { id } })
}

/** 查询用户在某篇诗文中的所有句子收藏 */
export const querySentenceStarsByPoem = async (userId: number, poemId: string) => {
    return prisma.sentenceStar.findMany({
        where: { userId, poemId },
        orderBy: { createdAt: "desc" }
    })
}

/** 查询用户的所有句子收藏（含诗文信息） */
export const queryAllSentenceStars = async (userId: number) => {
    const stars = await prisma.sentenceStar.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { poem: { select: { title: true, version: true, author: true, dynasty: true } } }
    })
    return stars
}
