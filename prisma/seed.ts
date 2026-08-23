import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// 读取JSON文件的辅助函数
function readJsonFile(filePath: string): any {
    if (!fs.existsSync(filePath)) {
        // 文件不存在则直接返回 null，不报错
        return null
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(content)
    } catch (error) {
        // JSON 格式错误等情况才打印
        console.error(`Error parsing JSON in file ${filePath}:`, error)
        return null
    }
}

// 读取order.tsx文件获取顺序
function getOrderFromFile(filePath: string): string[] {
    try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const match = content.match(/export const order = \[([\s\S]*?)\]/)
        if (match) {
            const orderArray = match[1]
                .replace(/\n/g, '')
                .split(',')
                .map(item => item.trim().replace(/['"]/g, ''))
                .filter(item => item.length > 0)
            return orderArray
        }
    } catch (error) {
        console.error(`Error reading order file ${filePath}:`, error)
    }
    return []
}

export async function main() {
    const basePath = path.join(__dirname, '../src/data')
    
    // 清空现有数据
    // await prisma.checkIn.deleteMany() 
    // await prisma.quote.deleteMany()
    await prisma.star.deleteMany()
    await prisma.sentenceStar.deleteMany()
    await prisma.article.deleteMany()
    await prisma.author.deleteMany()
    await prisma.poem.deleteMany()
    await prisma.event.deleteMany()
    
    // 处理名句数据 - 只添加新的quote记录
    const quotePath = path.join(basePath, 'quote', 'index.json')
    const quoteData = readJsonFile(quotePath)
    
    if (quoteData && Array.isArray(quoteData)) {
        for (const quote of quoteData) {
            // 检查quote是否已存在
            const existingQuote = await prisma.quote.findFirst({
                where: {
                    quote: quote.quote,
                    author: quote.author
                }
            })
            
            // 如果不存在，则创建新记录
            if (!existingQuote) {
                await prisma.quote.create({
                    data: {
                        title: quote.title,
                        quote: quote.quote,
                        author: quote.author,
                        dynasty: quote.dynasty
                    }
                })
            }
        }
    }
    
    // 处理诗歌数据（junior & senior）
    const versions = ['junior', 'senior']
    for (const ver of versions) {
        const order = getOrderFromFile(path.join(basePath, `poem/${ver}/order.tsx`))
        for (const poemName of order) {
            const poemPath = path.join(basePath, `poem/${ver}`, poemName, 'index.json')
            const poemData = readJsonFile(poemPath)

            if (poemData) {
                const exists = await prisma.poem.findFirst({
                    where: {
                        version: ver,
                        title: poemData.title
                    }
                })

                if (exists) {
                    console.log(`🚨 Duplicate detected: version=${ver}, title=${poemData.title}`)
                    continue
                }

                await prisma.poem.create({
                    data: {
                        title: poemData.title,
                        version: ver,
                        tags: poemData.tags || [],
                        author: poemData.author,
                        dynasty: poemData.dynasty,
                        mode: poemData.mode || 'poem',
                        content: poemData.content
                    }
                })
            }
        }
    }
    
    // 处理文章数据
    const articleOrder = getOrderFromFile(path.join(basePath, 'article/order.tsx'))
    for (const articleName of articleOrder) {
        const articlePath = path.join(basePath, 'article', articleName, 'index.json')
        const articleData = readJsonFile(articlePath)
        
        if (articleData) {
            await prisma.article.create({
                data: {
                    title: articleData.title,
                    author: articleData.author,
                    dynasty: articleData.dynasty,
                    views: articleData.views || 0,
                    abstract: articleData.abstract,
                    content: articleData.content,
                    img: articleData.img,
                    tags: articleData.tags || []
                }
            })
        }
    }
    
    // 处理作者数据
    const authorOrder = getOrderFromFile(path.join(basePath, 'author/order.tsx'))
    for (const authorName of authorOrder) {
        const authorPath = path.join(basePath, 'author', authorName, 'index.json')
        const authorData = readJsonFile(authorPath)
        
        if (authorData) {
            await prisma.author.create({
                data: {
                    name: authorData.name,
                    dynasty: authorData.dynasty,
                    epithet: authorData.epithet,
                    quote: authorData.quote,
                    avatar: authorData.avatar,
                    intro: authorData.intro,
                    tags: authorData.tags || []
                }
            })
        }
    }
    
    // 处理历史事件数据
    const eventPath = path.join(basePath, 'event', 'index.json')
    const eventData = readJsonFile(eventPath)

    if (eventData && Array.isArray(eventData)) {
        for (const event of eventData) {
            await prisma.event.create({
                data: {
                    year: event.year,
                    month: event.month,
                    day: event.day,
                    type: event.type,
                    figure: event.figure,
                    importance: event.importance,
                    data: event.data
                }
            })
        }
    }

    // 处理默写真题数据（scripts/dictation 下的标注结果 + 考察记录）
    await seedDictations()

    console.log('Seed data created successfully from file system')
}

// ---------- 默写真题导入 ----------
// 标题归一化：去书名号、空格
function normalizeTitle(s: string): string {
    return s.replace(/[《》〈〉\s·]/g, '')
}

// 从考察路径解析试卷信息：./{category}/语文/{paper}/auto/xxx.md
function parseAppearancePath(p: string): { category: string; grade: string; year: number; region: string; paper: string } | null {
    const m = p.match(/\.\/([^/]+)\/语文\/([^/]+)\//)
    if (!m) return null
    const paper = m[2]
    const ym = paper.match(/(\d{4})/)
    const region =
        /北京/.test(paper) ? '北京' :
        /全国/.test(paper) ? '全国' :
        /天津/.test(paper) ? '天津' :
        /上海/.test(paper) ? '上海' :
        /江苏/.test(paper) ? '江苏' :
        /海南/.test(paper) ? '海南' : '其他'
    // 年级：真题/一模/二模均为高三；期末按卷名中的年级关键词
    const grade =
        ['真题', '一模', '二模'].includes(m[1]) ? '高三' :
        /高三/.test(paper) ? '高三' :
        /高二/.test(paper) ? '高二' :
        /高一/.test(paper) ? '高一' : '高三'
    return {
        category: m[1],
        grade,
        year: ym ? parseInt(ym[1], 10) : 0,
        region,
        paper
    }
}

async function seedDictations() {
    const dictDir = path.join(__dirname, '../scripts/dictation')
    const annotated = readJsonFile(path.join(dictDir, 'dictations_annotated.json'))
    const fullData = readJsonFile(path.join(dictDir, 'dictations_full.json'))
    if (!annotated || !Array.isArray(fullData)) {
        console.log('⚠️ 默写数据文件缺失，跳过')
        return
    }

    await prisma.dictationAppearance.deleteMany()
    await prisma.dictation.deleteMany()

    // 数据库篇名映射：归一化标题 → { title, version }，同标题多版本时 senior 优先
    const poems = await prisma.poem.findMany({ select: { title: true, version: true } })
    const poemByNorm = new Map<string, { title: string; version: string }>()
    for (const p of poems) {
        const key = normalizeTitle(p.title)
        const cur = poemByNorm.get(key)
        if (!cur || (cur.version !== 'senior' && p.version === 'senior')) {
            poemByNorm.set(key, { title: p.title, version: p.version })
        }
    }

    // 出处篇名 → 数据库篇名（精确归一化匹配，其次双向包含，避免短标题误配要求 ≥3 字）
    function resolvePoem(title: string | undefined): { title: string; version: string } | null {
        if (!title) return null
        const key = normalizeTitle(title)
        const exact = poemByNorm.get(key)
        if (exact) return exact
        for (const [norm, info] of poemByNorm) {
            if (key.length >= 3 && (norm.includes(key) || key.includes(norm))) return info
        }
        return null
    }

    // full 数据按 id 与 content 建立索引（annotated 的 key 与 full 数组下标不对应）
    const fullById = new Map<number, any>(fullData.map((x: any) => [x.id, x]))
    const fullByContent = new Map<string, any[]>()
    for (const x of fullData) {
        if (!fullByContent.has(x.content)) fullByContent.set(x.content, [])
        fullByContent.get(x.content)!.push(x)
    }

    // 手动拆分拼接长句产生的条目（条目 id >= 2088，full 中无记录）：
    // 考察列表继承其前一个原始条目（id < 2088）在 full 中的记录
    const MANUAL_ID = 2088
    let prevOriginalId: number | null = null
    const inheritedId = new Map<object, number>()
    for (const v of Object.values<any>(annotated)) {
        if (typeof v.id === 'number' && v.id >= MANUAL_ID) {
            if (prevOriginalId !== null) inheritedId.set(v, prevOriginalId)
        } else {
            prevOriginalId = v.id
        }
    }

    // 标注数据中存在同句多条（如 db 与 ai 各标注一次），按 content 合并：
    // 主条目按 sourceType 可信度 db > db-revised > ai 取，考察记录按卷名去重合并
    const sourceRank: Record<string, number> = { db: 0, 'db-revised': 1, ai: 2, none: 3 }
    const groups = new Map<string, any[]>()
    for (const v of Object.values<any>(annotated)) {
        if (!groups.has(v.content)) groups.set(v.content, [])
        groups.get(v.content)!.push(v)
    }
    const merged = [...groups.values()].map(vs =>
        vs.sort((a, b) => (sourceRank[a.sourceType] ?? 9) - (sourceRank[b.sourceType] ?? 9) || a.id - b.id)
    )
    const mergedCount = annotated ? Object.values<any>(annotated).length - merged.length : 0

    let appearanceCount = 0
    let linkedCount = 0
    for (const vs of merged) {
        const v = vs[0]
        const poem = resolvePoem(v.source?.title)
        if (poem) linkedCount++

        // 组内所有条目对应的 full 记录都参与考察合并（手动条目用继承的 id 查）
        const fullEntries: any[] = []
        const seenFull = new Set<number>()
        for (const x of vs) {
            const lookupId = typeof x.id === 'number' && x.id >= MANUAL_ID ? inheritedId.get(x) : x.id
            const fs = (lookupId !== undefined && fullById.get(lookupId)) ? [fullById.get(lookupId)] : (fullByContent.get(x.content) || [])
            for (const f of fs) {
                if (f && !seenFull.has(f.id)) {
                    seenFull.add(f.id)
                    fullEntries.push(f)
                }
            }
        }

        await prisma.dictation.create({
            data: {
                id: v.id,
                content: v.content,
                revised: v.revised || null,
                sourceType: v.sourceType,
                note: v.note || null,
                title: v.source?.title || null,
                author: v.source?.author || null,
                dynasty: v.source?.dynasty || null,
                poemTitle: poem?.title || null,
                poemVersion: poem?.version || null,
                appearances: {
                    create: (() => {
                        const seen = new Set<string>()
                        const rows: any[] = []
                        for (const f of fullEntries) {
                            if (!f || !Array.isArray(f.appearance)) continue
                            for (const a of f.appearance) {
                                const parsed = parseAppearancePath(a.path)
                                if (!parsed || seen.has(parsed.paper)) continue
                                seen.add(parsed.paper)
                                rows.push(parsed)
                            }
                        }
                        appearanceCount += rows.length
                        return rows
                    })()
                }
            }
        })
    }

    console.log(`默写数据导入完成：${merged.length} 句（合并 ${mergedCount} 条重复），${appearanceCount} 条考察记录，${linkedCount} 句可跳转诗文页`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })