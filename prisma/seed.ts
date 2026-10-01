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

interface SyncConfig<T> {
    // 表名（用于日志/告警）
    label: string
    // 源数据列表
    source: T[]
    // 从源数据求自然键（用于去重 + 残留比对）
    key: (item: T) => string
    // 数据库对象，如 prisma.poem
    delegate: any
    // 源数据 → upsert 参数
    build: (item: T) => { where: any; create: any; update: any }
    // 从数据库已有行求自然键（用于残留比对）
    dbKey: (row: any) => string
    // 可选：残留行的可读描述，默认用 dbKey
    describe?: (row: any) => string
    // 可选：计算某行被引用的次数；缺省视为 0（无引用，直接清理，不告警）
    refs?: (row: any) => Promise<number>
}

// 通用幂等同步：对源数据逐个 upsert、重复自然键告警，
// 再按自然键 + refs 清理源数据中已移除的残留行
async function syncTable<T>(config: SyncConfig<T>) {
    const { label, source, key, delegate, build, dbKey, describe, refs } = config

    // 源数据为空视为读取失败，跳过同步以免误删全表
    if (source.length === 0) {
        console.warn(`⚠️ ${label} 源数据为空，跳过同步`)
        return
    }

    const seen = new Set<string>()
    for (const item of source) {
        const k = key(item)
        if (seen.has(k)) {
            console.log(`🚨 Duplicate detected: ${label} key=${k}`)
            continue
        }
        seen.add(k)
        const { where, create, update } = build(item)
        await delegate.upsert({ where, create, update })
    }

    // 清理源数据中已移除的残留行
    const removed: string[] = []
    for (const row of await delegate.findMany()) {
        if (seen.has(dbKey(row))) continue
        const refCount = refs ? await refs(row) : 0
        const desc = describe ? describe(row) : dbKey(row)
        if (refCount > 0) {
            console.warn(`⚠️ ${label}「${desc}」已从源数据移除，但仍被 ${refCount} 处引用，跳过删除`)
            continue
        }
        await delegate.delete({ where: { id: row.id } })
        removed.push(desc)
    }
    if (removed.length > 0) {
        console.log(`🧹 清理已移除${label} ${removed.length} 条：${removed.join('、')}`)
    }
}

export async function main() {
    const basePath = path.join(__dirname, '../src/data')
    
    // 只清理重建内容型数据（event 无自然唯一键，按卷重建）；
    // 用户数据（user/star/sentenceStar/checkIn）与 poem/article/author 一律不删除，
    // 改用 upsert 幂等更新，避免清空用户收藏及其外键引用
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
    const poemSources: any[] = []
    for (const ver of versions) {
        const order = getOrderFromFile(path.join(basePath, `poem/${ver}/order.tsx`))
        for (const poemName of order) {
            const poemPath = path.join(basePath, `poem/${ver}`, poemName, 'index.json')
            const poemData = readJsonFile(poemPath)
            if (poemData) {
                poemSources.push({ ver, data: poemData })
            }
        }
    }

    // 清理源数据中已移除的诗文；被用户收藏（star/sentenceStar）引用的跳过
    await syncTable({
        label: '诗文',
        source: poemSources,
        key: (p) => `${p.ver}/${p.data.title}`,
        delegate: prisma.poem,
        build: (p) => {
            const data = {
                title: p.data.title,
                version: p.ver,
                tags: p.data.tags || [],
                author: p.data.author,
                dynasty: p.data.dynasty,
                mode: p.data.mode || 'poem',
                content: p.data.content
            }
            return {
                where: { compoundId: { version: p.ver, title: p.data.title } },
                create: data,
                update: data
            }
        },
        dbKey: (row) => `${row.version}/${row.title}`,
        describe: (row) => `${row.title}（${row.version}）`,
        refs: async (row) => {
            const [starRefs, sentenceRefs] = await Promise.all([
                prisma.star.count({ where: { poemId: row.id } }),
                prisma.sentenceStar.count({ where: { poemId: row.id } })
            ])
            return starRefs + sentenceRefs
        }
    })
    
    // 处理文章数据
    const articleOrder = getOrderFromFile(path.join(basePath, 'article/order.tsx'))
    const articleSources: any[] = []
    for (const articleName of articleOrder) {
        const articlePath = path.join(basePath, 'article', articleName, 'index.json')
        const articleData = readJsonFile(articlePath)
        if (articleData) articleSources.push(articleData)
    }

    // 清理源数据中已移除的文章（无用户外键关联，refs 缺省即 0，直接清理）
    await syncTable({
        label: '文章',
        source: articleSources,
        key: (a) => a.title,
        delegate: prisma.article,
        build: (a) => {
            const data = {
                author: a.author,
                dynasty: a.dynasty,
                abstract: a.abstract,
                content: a.content,
                img: a.img,
                tags: a.tags || []
            }
            return {
                where: { title: a.title },
                // views 是用户侧累计数据，仅在新建时初始化，更新时不覆盖
                create: { title: a.title, views: a.views || 0, ...data },
                update: data
            }
        },
        dbKey: (row) => row.title,
        describe: (row) => row.title
    })
    
    // 处理作者数据
    const authorOrder = getOrderFromFile(path.join(basePath, 'author/order.tsx'))
    const authorSources: any[] = []
    for (const authorName of authorOrder) {
        const authorPath = path.join(basePath, 'author', authorName, 'index.json')
        const authorData = readJsonFile(authorPath)
        if (authorData) authorSources.push(authorData)
    }

    // 清理源数据中已移除的作者（无用户外键关联，refs 缺省即 0，直接清理）
    await syncTable({
        label: '作者',
        source: authorSources,
        key: (a) => a.name,
        delegate: prisma.author,
        build: (a) => {
            const data = {
                dynasty: a.dynasty,
                epithet: a.epithet,
                quote: a.quote,
                avatar: a.avatar,
                intro: a.intro,
                tags: a.tags || []
            }
            return {
                where: { name: a.name },
                create: { name: a.name, ...data },
                update: data
            }
        },
        dbKey: (row) => row.name,
        describe: (row) => row.name
    })
    
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