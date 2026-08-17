import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = path.join(__dirname, 'dictations_simplified.json');
const OUTPUT_PATH = path.join(__dirname, 'dictations_annotated.json');
const CONFIG_PATH = path.join(__dirname, 'ai_config.json');

// Prisma 需要 DATABASE_URL；若未设置则从仓库根目录 .env 读取（仅读取，不修改）
if (!process.env.DATABASE_URL) {
    const envText = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8');
    const m = envText.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
    if (m) process.env.DATABASE_URL = m[1];
}

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

// ---------- AI 调用配置（从 ai_config.json 读取） ----------
const aiConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { apiUrl: AI_URL, apiKey: AI_KEY, model: AI_MODEL, maxRetries: MAX_RETRIES } = aiConfig;

async function callAI(prompt) {
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(AI_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AI_KEY}`
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0,
                    reasoning_effort: 'high'
                }),
                signal: AbortSignal.timeout(300000)
            }).then(r => r.text());
            let json;
            try { json = JSON.parse(res); } catch { throw new Error('响应不是 JSON'); }
            if (json.error || !json.choices?.[0]?.message?.content) {
                throw new Error(json.error?.message || '响应缺少 choices');
            }
            return json.choices[0].message.content;
        } catch (err) {
            lastErr = err;
            console.error(`[DeepSeek] 第 ${attempt} 次失败：${err.message}`);
            if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, attempt * 5000));
        }
    }
    throw new Error(`AI 请求连续 ${MAX_RETRIES} 次失败：${lastErr?.message}`);
}

// ---------- 句子匹配 ----------
const PUNCT = /[，。；？！、：,…—·\s「」『』“”"'"'"'（）()《》【】]/;

// 按标点切分为片段（过滤长度 < 2 的碎片），用于容忍标点差异的匹配
function fragments(s) {
    return s.split(PUNCT).filter(f => f.length >= 2);
}

// 去除全部标点后的归一化文本，用于"精确包含"打分
function normalize(s) {
    return s.replace(PUNCT, '');
}

// 在诗库中查找包含该句子的所有诗（所有片段均需出现在同一首诗中）
// 精确匹配失败时，允许每个长片段（≥4 字）有 1 个字的用字变体（如"随君/随风直到夜郎西"）
// 返回 { list: 匹配的诗, fuzzy: 是否经由变体容错命中 }
function findMatches(poems, sentence) {
    const frs = fragments(sentence);
    if (frs.length === 0) return { list: [], fuzzy: false };
    const exact = poems.filter(pm => frs.every(f => pm.content.includes(f)));
    if (exact.length > 0) return { list: exact, fuzzy: false };
    return { list: poems.filter(pm => frs.every(f => fragmentInPoem(f, pm.content))), fuzzy: true };
}

// 片段是否出现在诗中（容忍 1 个字的替换：逐位把该字换成通配符再匹配）
function fragmentInPoem(frag, content) {
    if (content.includes(frag)) return true;
    if (frag.length < 4) return false; // 短片段不允许模糊，避免误匹配
    const escaped = [...frag].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return escaped.some((_, i) => {
        const pattern = escaped.slice(0, i).join('') + '.' + escaped.slice(i + 1).join('');
        return new RegExp(pattern).test(content);
    });
}

// 变体命中时，从诗中提取片段所在的最小覆盖文本，作为修订后的标准句
// 长诗文可能整篇存为一个 # 段，因此不能直接取整"行"，而是定位各片段位置后截取区间
function canonicalLine(poem, sentence) {
    const frs = fragments(sentence);
    let best = null, bestScore = -1;
    for (const rawLine of poem.content.split('#')) {
        const line = rawLine.trim();
        if (!line) continue;
        const score = frs.filter(f => fragmentInPoem(f, line)).length;
        if (score > bestScore) { bestScore = score; best = line; }
    }
    if (!best || bestScore !== frs.length) return null;
    let start = -1, end = -1;
    for (const f of frs) {
        const i = locateFragment(f, best);
        if (i === -1) return null;
        if (start === -1 || i < start) start = i;
        if (i + f.length > end) end = i + f.length;
    }
    const canon = best.slice(start, end).replace(/[。；？！，]$/,'');
    // 片段在长文中相距过远时放弃自动修订（如跳句拼接），避免截取出大段原文
    if (normalize(canon).length > normalize(sentence).length + 8) return null;
    return canon;
}

// 定位片段在行内的起始位置（先精确，再逐位容错 1 字）
function locateFragment(f, line) {
    const i = line.indexOf(f);
    if (i !== -1) return i;
    if (f.length < 4) return -1;
    const escaped = [...f].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    for (let k = 0; k < escaped.length; k++) {
        const m = new RegExp(escaped.slice(0, k).join('') + '(.)' + escaped.slice(k + 1).join('')).exec(line);
        if (m) return m.index;
    }
    return -1;
}

// 修订文本与原句的二元组重合度：防止 AI 把句子改写成其他诗的名句
// （如"至今商女，时时犹唱后庭遗曲"曾被改写成"商女不知亡国恨，隔江犹唱后庭花"）
function bigramOverlap(original, revised) {
    const grams = s => { const set = new Set(); const n = normalize(s); for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2)); return set; };
    const go = grams(original), gr = grams(revised);
    if (gr.size === 0) return 1;
    let hit = 0;
    for (const g of gr) if (go.has(g)) hit++;
    return hit / gr.size;
}
const REVISION_OVERLAP_MIN = 0.45; // 补全式修订通常 ≥0.5，跨句改写 <0.35

// 多个匹配时选出最佳：优先归一化后整句连续出现的
function pickBest(matches, sentence) {
    if (matches.length <= 1) return matches[0] || null;
    const norm = normalize(sentence);
    return matches.find(pm => normalize(pm.content).includes(norm)) || matches[0];
}

// ---------- 主流程 ----------
async function main() {
    const dictations = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    console.log(`共 ${dictations.length} 个句子`);

    // 只读查询数据库，加载全部古诗到内存
    const poems = await prisma.poem.findMany({
        select: { id: true, title: true, author: true, dynasty: true, version: true, content: true }
    });
    console.log(`数据库诗库共 ${poems.length} 首`);

    // 断点续传：复用上次已完成的 AI 结果（按原句内容对齐；'failed' 表示上次失败，需重试）
    let prevResults = new Map();
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            for (const item of JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))) {
                if (['db-revised', 'ai', 'none'].includes(item.sourceType)) {
                    prevResults.set(item.content, item);
                }
            }
            console.log(`检测到上次进度，已处理 AI 结果 ${prevResults.size} 条`);
        } catch { /* 输出文件损坏则重新开始 */ }
    }

    // 第一阶段：数据库直接匹配（含一字变体容错，命中变体时修订为库内原文）
    const results = [];
    const pending = []; // 待 AI 处理的项（含其在 results 中的下标）
    for (const d of dictations) {
        const entry = { content: d.content, id: d.id, _count: d._count };
        const prev = prevResults.get(d.content);
        if (prev) {
            // 沿用上次的 AI 处理结果
            results.push({ ...entry, revised: prev.revised, source: prev.source, sourceType: prev.sourceType, note: prev.note });
            continue;
        }
        const { list: matches, fuzzy } = findMatches(poems, d.content);
        if (matches.length > 0) {
            const best = pickBest(matches, d.content);
            entry.sourceType = 'db';
            entry.source = { title: best.title, author: best.author, dynasty: best.dynasty, version: best.version };
            if (matches.length > 1) {
                entry.matches = [...new Set(matches.map(m => m.title))];
            }
            if (fuzzy) {
                const canon = canonicalLine(best, d.content);
                if (canon && normalize(canon) !== normalize(d.content)) {
                    entry.revised = canon;
                    entry.note = '试卷用字与库内原文有差异，已按库内原文修订';
                }
            }
            results.push(entry);
        } else {
            entry.sourceType = null; // 待 AI 处理
            results.push(entry);
            pending.push({ idx: results.length - 1, content: d.content });
        }
    }
    console.log(`数据库直接匹配 ${dictations.length - pending.length - prevResults.size} 条，待 AI 处理 ${pending.length} 条`);
    save(results);

    // 第二阶段：AI 批量修订 + 标注出处，随后用修订句回查数据库
    // DeepSeek reasoning 较慢：5 句/批、300s 超时、2 路并发（过大易超时）
    const BATCH_SIZE = 5;
    const CONCURRENCY = 2;
    const batches = [];
    for (let i = 0; i < pending.length; i += BATCH_SIZE) batches.push(pending.slice(i, i + BATCH_SIZE));

    async function handleBatch(batch, no) {
        console.log(`AI 批次 ${no}/${batches.length}（${batch.length} 句）`);
        let aiItems = null;
        try {
            aiItems = await processBatch(batch);
        } catch (err) {
            console.error(`批次 ${no} 失败：${err.message}`);
        }
        for (const { idx, content } of batch) {
            const entry = results[idx];
            const ai = aiItems && aiItems.find(a => a && typeof a === 'object' && String(a.idx) === String(idx));
            if (!ai) {
                entry.sourceType = 'failed'; // 本次失败，重跑脚本时会重试
                continue;
            }
            const revised = (ai.revised || '').trim();
            entry.revised = revised && revised !== content ? revised : undefined;
            // 用修订后的句子优先回查数据库；但修订必须是补全/改错而非改写成别的句子
            const queryText = entry.revised || content;
            const overlapOK = !entry.revised || bigramOverlap(content, entry.revised) >= REVISION_OVERLAP_MIN;
            const { list: matches, fuzzy } = overlapOK ? findMatches(poems, queryText) : { list: [], fuzzy: false };
            if (matches.length > 0) {
                const best = pickBest(matches, queryText);
                entry.sourceType = 'db-revised';
                entry.source = { title: best.title, author: best.author, dynasty: best.dynasty, version: best.version };
                if (matches.length > 1) entry.matches = [...new Set(matches.map(m => m.title))];
                if (fuzzy) {
                    const canon = canonicalLine(best, queryText);
                    if (canon && normalize(canon) !== normalize(queryText)) {
                        entry.revised = canon;
                        entry.note = '已按库内原文修订';
                    }
                }
            } else {
                entry.sourceType = 'ai';
                const title = (ai.title || '').trim();
                entry.source = title ? { title, author: (ai.author || '').trim() || null, dynasty: (ai.dynasty || '').trim() || null } : null;
                if (!title) entry.sourceType = 'none';
            }
            if (ai.note && ai.note.trim()) entry.note = (entry.note ? entry.note + '；' : '') + ai.note.trim();
        }
        save(results);
    }

    let next = 0;
    async function worker() {
        while (next < batches.length) {
            const no = ++next;
            await handleBatch(batches[no - 1], no);
            await new Promise(r => setTimeout(r, 1000)); // 批次间隔，避免请求过快
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    // 汇总；对 AI 标注且篇名不在常见篇目清单/数据库的条目打上人工核查标记
    const knownTitles = new Set([
        ...ANTHOLOGY.split('、').map(s => s.replace(/[《》]/g, '').trim()).filter(Boolean),
        ...poems.map(p => p.title)
    ]);
    let suspect = 0;
    for (const r of results) {
        if (r.sourceType !== 'ai' || !r.source?.title) continue;
        const t = r.source.title.trim();
        const ok = [...knownTitles].some(K => t === K || t.startsWith(K + '·') || t.startsWith(K + '（') || t.startsWith(K + '(') || t.startsWith(K + '其'));
        if (!ok && !r.note?.includes('请人工核查')) {
            r.note = (r.note ? r.note + '；' : '') + '篇名不在常见篇目清单，请人工核查';
            suspect++;
        }
    }
    const stats = {};
    for (const r of results) stats[r.sourceType] = (stats[r.sourceType] || 0) + 1;
    console.log('处理完成，结果分布：', JSON.stringify(stats), '，AI 标注待人工核查：', suspect);
    console.log(`已写入 ${OUTPUT_PATH}`);
    save(results);

    await prisma.$disconnect();
}

// 高频必背篇目清单，用于锚定 AI 标注（数据库 201 首之外常考的篇目）
const ANTHOLOGY = '《论语》《孟子》三则、曹刿论战、邹忌讽齐王纳谏、出师表、桃花源记、三峡、马说、陋室铭、小石潭记、岳阳楼记、醉翁亭记、爱莲说、记承天寺夜游、送东阳马生序、关雎、蒹葭、木兰诗、十五从军征、送杜少府之任蜀州、登幽州台歌、次北固山下、使至塞上、闻王昌龄左迁龙标遥有此寄、行路难、黄鹤楼、望岳、春望、茅屋为秋风所破歌、白雪歌送武判官归京、酬乐天扬州初逢席上见赠、卖炭翁、钱塘湖春行、雁门太守行、赤壁、泊秦淮、夜雨寄北、无题、相见欢、渔家傲·秋思、江城子·密州出猎、水调歌头·明月几时有、破阵子·为陈同甫赋壮词以寄之、游山西村、己亥杂诗、满江红、静女、无衣、离骚、涉江采芙蓉、虞美人、短歌行、归园田居、拟行路难、春江花月夜、山居秋暝、蜀道难、梦游天姥吟留别、将进酒、燕歌行、蜀相、客至、登高、登岳阳楼、琵琶行、锦瑟、李凭箜篌引、菩萨蛮、桂枝香·金陵怀古、念奴娇·赤壁怀古、念奴娇·过洞庭、永遇乐·京口北固亭怀古、声声慢、书愤、临安春雨初霁、长亭送别、朝天子·咏喇叭、劝学、逍遥游、师说、赤壁赋、阿房宫赋、六国论、答司马谏议书、项脊轩志、子路曾皙冉有公西华侍坐、报任安书、过秦论、礼运、汴河曲、兰亭集序、归去来兮辞、种树郭橐驼传、石钟山记、登泰山记、黄冈竹楼记、上枢密韩太尉书、滕王阁序、国殇、湘夫人、烛之武退秦师、鸿门宴、庖丁解牛、齐桓晋文之事、游褒禅山记、苏幕遮·怀旧、一剪梅、菩萨蛮·书江西造口壁、青玉案·元夕、贺新郎、丑奴儿·书博山道中壁、太常引·建康中秋夜为吕叔潜赋、浪淘沙·把酒祝东风、玉楼春·春景、蝶恋花·槛菊愁烟兰泣露、破阵子·春景、鹧鸪天·重过阊门万事非、苏幕遮·燎沉香、满庭芳·山抹微云、望海潮·东南形胜、雨霖铃·寒蝉凄切、定风波·莫听穿林打叶声';

async function processBatch(batch) {
    const lines = batch.map(b => `${b.idx}. ${b.content}`).join('\n');
    const prompt = `你是高中语文教师，熟悉初高中语文必背古诗文篇目。常见篇目供参考：${ANTHOLOGY}（不限于这些）。

下面的句子提取自默写试卷，可能存在错别字、用字变体（如"随君/随风"）、挖空残留或截断。请逐一处理并标注出处。

要求：
1. revised：修订为原文标准句子（修正错别字与变体，补全残缺）；若无法识别或不是诗句，保持原样。
2. title：出处篇名，不带书名号（如：滕王阁序、国殇、游褒禅山记、苏幕遮·怀旧）。没有十足把握时必须留空字符串，严禁猜测编造。
3. author/dynasty：作者与朝代（不确定留空字符串）。
4. note：简要说明修订原因或特殊情况。

严格输出 JSON 数组，不要输出任何其他内容，格式：
[{"idx":<编号>,"revised":"...","title":"...","author":"...","dynasty":"...","note":"..."}]

句子列表：
${lines}`;

    const raw = await callAI(prompt);
    // 提取 JSON（容忍 markdown 代码块包裹）
    const text = raw.replace(/```(json)?/g, '');
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('响应中未找到 JSON 数组');
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) throw new Error('JSON 解析结果不是数组');
    return arr;
}

function save(results) {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 4));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
