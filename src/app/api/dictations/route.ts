import { NextRequest } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// 获取默写真题句列表（含考察记录），前端按年份/地区/类别筛选并按考察次数排序
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const sourceType = searchParams.get('sourceType')
    // 分批拉取，1782 句 + 考察记录总量约 1MB，一次返回可接受
    const take = Math.min(parseInt(searchParams.get('take') || '2000', 10), 2000)

    try {
        const dictations = await prisma.dictation.findMany({
            where: {
                sourceType: sourceType || undefined
            },
            include: {
                        appearances: {
                            select: {
                                category: true,
                                grade: true,
                                year: true,
                                region: true,
                                paper: true
                            }
                        }
                    },
            take
        })

        return Response.json(dictations)
    } catch (error) {
        console.error('Error fetching dictations:', error)
        return Response.json(
            { error: '获取默写数据失败' },
            { status: 500 }
        )
    }
}
