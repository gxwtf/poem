import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/iron'
import prisma from '@/lib/prisma'

export async function GET() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

    if (!session?.isLoggedIn) {
        return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    try {
        // 获取用户连续签到天数
        const checkIns = await prisma.checkIn.findMany({
            where: { userId: session.userid },
            orderBy: { date: 'desc' },
            take: 30
        })

        // 计算连续签到天数
        let streak = 0
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        for (let i = 0; i < checkIns.length; i++) {
            const checkInDate = new Date(checkIns[i].date)
            checkInDate.setHours(0, 0, 0, 0)

            const diffTime = today.getTime() - checkInDate.getTime()
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

            if (diffDays === i) {
                streak++
            } else {
                break
            }
        }

        // 检查今日是否已签到
        const todayCheckIn = await prisma.checkIn.findFirst({
            where: {
                userId: session.userid,
                date: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    lt: new Date(new Date().setHours(23, 59, 59, 999))
                }
            },
            include: {
                quote: true  // 包含关联的quote数据
            }
        })
        
        let todayQuote
        if (todayCheckIn) {
            // 如果今日已签到，使用已存储的quote
            todayQuote = {
                title: todayCheckIn.quote.title,
                quote: todayCheckIn.quote.quote,
                author: todayCheckIn.quote.author,
                dynasty: todayCheckIn.quote.dynasty
            }
        } else {
            // 如果今日未签到，随机获取一条名句
            const quotes = await prisma.quote.findMany()
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)]
            todayQuote = {
                title: randomQuote.title,
                quote: randomQuote.quote,
                author: randomQuote.author,
                dynasty: randomQuote.dynasty
            }
        }

        return NextResponse.json({
            streak,
            todayQuote: {
                title: todayQuote.title,
                quote: todayQuote.quote,
                author: todayQuote.author,
                dynasty: todayQuote.dynasty
            },
            hasCheckedIn: !!todayCheckIn
        })
    } catch (error) {
        return NextResponse.json(
            { error: '获取签到数据失败', message: error },
            { status: 500 }
        )
    }
}

export async function POST() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

    if (!session?.isLoggedIn) {
        return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    try {
        // 检查今日是否已签到
        const today = new Date()
        const todayStart = new Date(today.setHours(0, 0, 0, 0))
        const todayEnd = new Date(today.setHours(23, 59, 59, 999))

        const existingCheckIn = await prisma.checkIn.findFirst({
            where: {
                userId: session.userid,
                date: {
                    gte: todayStart,
                    lt: todayEnd
                }
            }
        })

        if (existingCheckIn) {
            return NextResponse.json(
                { error: '今日已签到' },
                { status: 400 }
            )
        }

        // 随机获取一条名句
        const quotes = await prisma.quote.findMany()
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)]

        // 创建签到记录
        if (session.userid) {
            await prisma.checkIn.create({
                data: {
                    userId: session.userid,
                    date: new Date(),
                    quoteId: randomQuote.id  // 添加quoteId
                }
            })
        }

        return NextResponse.json({
            success: true,
            message: '签到成功',
            todayQuote: {
                title: randomQuote.title,
                quote: randomQuote.quote,
                author: randomQuote.author,
                dynasty: randomQuote.dynasty
            }
        })
    } catch (error) {
        console.error('签到失败:', error)
        return NextResponse.json(
            { error: '签到失败' },
            { status: 500 }
        )
    }
}