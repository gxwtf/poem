/**
 * 本脚本用于自动生成古诗文的 full.json 文件。
 *
 * 功能说明：
 * 1. 读取 junior/senior 版本的 order.tsx，获取所需生成的古诗文名称。
 * 2. 根据名称从同目录下的 junior.json / senior.json 中模糊查询对应的古诗文原始数据。
 * 3. 按照指定结构（段落、句子、字级拼音与索引）生成 full.json 文件。
 * 4. 在 `--add` 模式下，仅为不存在的诗文文件夹创建 full.json。
 * 5. 在 `--force` 模式下，根据 forceList 强制覆盖已有 full.json。
 * 6. 生成的文件夹权限为 755，full.json 权限为 666，确保所有用户可读写。
 *
 * 主要逻辑参考：
 * - normalizeName()：用于统一名称格式，便于模糊匹配（会移除标点、空格、书名号等）
 * - buildParagraphs()：用于将 content / translation / pinyin 转换为结构化段落数据
 * - createFullJson()：执行文件夹创建、权限设置、full.json 文件生成等核心操作
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { normalizeName, findMeta } from './compare.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------- CONFIG --------
/** 强制更新列表，用于 --force 模式下指定必须覆盖的诗文名称 */
const forceList = {
    junior: [],
    senior: ["鸿门宴"]
};

let GLOBAL_TAG_LIST = [];

function parseArgList(args, key) {
    const item = args.find(a => a.startsWith(`--${key}=`));
    if (!item) return [];
    return item.slice(key.length + 3).split(",").map(s => s.trim()).filter(Boolean);
}

// -------- UTIL --------
/**
 * 句子切分规则：
 * - 仅以 ：；。？！…… 作为真正的断句标点
 * - 引号（“ ” ‘ ’ ）不作为断句依据
 * - 若断句标点后紧跟引号，引号应归入本句
 */
const SENTENCE_MATCH_REGEX =
    /[^；。？！……]+[”’"]*[；。？！……]+[”’"]*|[^；。？！……]+$/g;

/** 中文及常见标点集合，用于判断某字符是否属于标点 */
const PUNCTUATION_SET = new Set(
    Array.from('，。！？；：、“”‘’（）《》【】…—·,.?!:;()"\'')
);

const isPunctuation = (ch) => PUNCTUATION_SET.has(ch);

/** 将整行拼音按空格拆分为单字拼音数组 */
function splitPinyin(pinyinStr) {
    if (!pinyinStr) return [];
    return pinyinStr.trim().split(/\s+/);
}

/**
 * 构建 paragraphs 数据结构。
 *
 * 步骤：
 * 1. 按 "/" 将正文拆分为段落。
 * 2. 使用正则匹配每段中的句子。
 * 3. 将句子拆成单字，填充 char / pinyin / index。
 * 4. 对 translation 做相同的句子拆分，并与正文句子一一对应。
 */
function buildParagraphs(content, translation, pinyin) {
    const rawParagraphs = (content || "").split("/").map(p => p.trim()).filter(Boolean);
    const pinyinList = splitPinyin(pinyin || "");
    let pinyinIndex = 0;
    let globalIndex = 0;

    // ---- Global sentence alignment (ignore paragraph structure for translation) ----
    const globalRawSentences = (content || "")
        .replaceAll("/", "")
        .match(SENTENCE_MATCH_REGEX) || [];

    const globalTransSentences = (translation || "")
        .match(SENTENCE_MATCH_REGEX) || [];

    let globalSentenceCursor = 0;

    const paragraphs = rawParagraphs.map((paraStr) => {
        // match sentences including trailing punctuation
        const rawSentences = (paraStr.match(SENTENCE_MATCH_REGEX) || [paraStr]).map(s => s.trim()).filter(Boolean);

        const sentences = rawSentences.map((sentence) => {
            const contentArr = [];
            // iterate by code points to handle any multi-byte characters safely
            const chars = Array.from(sentence);
            for (let i = 0; i < chars.length; i++) {
                const ch = chars[i];
                let py = "";
                if (!isPunctuation(ch)) {
                    py = pinyinList[pinyinIndex] || "";
                    pinyinIndex++;
                }
                contentArr.push({
                    char: ch,
                    pinyin: py,
                    index: globalIndex
                });
                globalIndex++;
            }
            const sentenceIndex = globalSentenceCursor++;
            const trans = globalTransSentences[sentenceIndex] || "";
            if (ENABLE_LOG) {
                const rawSentence = contentArr.map(c => c.char).join("");
                console.log("🧾 原文句子：", rawSentence);
                console.log("📘 对应翻译：", trans || "(空)");
                console.log("-----");
            }
            return {
                content: contentArr,
                translation: trans
            };
        });

        return { sentences };
    });

    return paragraphs;
}

/**
 * 读取指定版本的 order.tsx 文件，提取其中的诗文名称数组。
 * order.tsx 的格式如下：
 * export const order = ["观沧海", "木兰诗", ...];
 */
function loadOrder(version) {
    const orderPath = path.join(__dirname, "../../src/data/poem", version, "order.tsx");
    if (!fs.existsSync(orderPath)) {
        console.error(`❌ 找不到 ${version} 的 order.tsx 文件`);
        return [];
    }

    try {
        const content = fs.readFileSync(orderPath, "utf-8");
        // 提取数组内容
        const match = content.match(/export const order = \[([\s\S]*?)\];/);
        if (!match) {
            console.error(`❌ 无法解析 ${version} 的 order.tsx 文件`);
            return [];
        }

        const arrayContent = match[1];
        // 提取引号内的内容
        const poemNames = arrayContent.match(/["']([^"']+)["']/g) || [];
        return poemNames.map(name => name.slice(1, -1)); // 去掉引号
    } catch (e) {
        console.error(`❌ 读取 ${version} 的 order.tsx 文件失败`, e);
        return [];
    }
}

/**
 * 根据指定的版本与诗文名称创建 full.json。
 *
 * 特性：
 * - 自动读取 version.json（如 junior.json）进行元数据模糊匹配。
 * - 若文件夹不存在，则自动创建。
 * - 若 full.json 已存在且未指定 force，则跳过。
 * - 若指定 force，则强制覆盖。
 */
function createFullJson(version, poemName, force = false) {
    const poemDir = path.join(__dirname, "../../src/data/poem", version, poemName);
    const fullPath = path.join(poemDir, "full.json");

    // 检查文件夹是否存在
    const folderExists = fs.existsSync(poemDir);
    const fullExists = fs.existsSync(fullPath);

    if (!force && fullExists) {
        return { success: false, reason: "文件已存在" };
    }

    // 从 version 对应的 JSON 文件中加载元数据，并进行模糊查询
    const meta = findMeta(version, normalizeName(poemName), { name: poemName });

    if (!meta) {
        return { success: false, reason: "未在 JSON 中找到匹配的元数据" };
    }

    try {
        // 创建文件夹（如果不存在）
        if (!folderExists) {
            fs.mkdirSync(poemDir, { recursive: true, mode: 0o777 });
            fs.chmodSync(poemDir, 0o777);
        }

        let full = {};

        // 如果是 force 模式且 full.json 已存在，则只覆盖指定字段
        if (force && fs.existsSync(fullPath)) {
            full = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        }

        // 需要强制覆盖的字段列表
        const FORCE_KEYS = [
            "name",
            "author",
            "dynasty",
            "mode",
            "content",
            "translation",
            "annotation",
            "comprehensive_appreciation",
            "appreciation",
            "background",
            "pinyin"
        ];

        // 用 meta 中的数据覆盖上述字段
        for (const key of FORCE_KEYS) {
            if (key === "name") {
                full.name = poemName;
            } else if (key === "content" || key === "translation" || key === "pinyin") {
                // 这三个字段只用于生成 paragraphs，不直接写入 full
                continue;
            } else if (meta[key] !== undefined) {
                full[key] = meta[key];
            }
        }

        if (Array.isArray(GLOBAL_TAG_LIST) && GLOBAL_TAG_LIST.length > 0) {
            full.tags = Array.from(new Set([
                ...(full.tags || []),
                ...GLOBAL_TAG_LIST
            ]));
        }

        // 始终重新生成 paragraphs（依赖 content / translation / pinyin）
        full.paragraphs = buildParagraphs(
            meta.content || "",
            meta.translation || "",
            meta.pinyin || ""
        );

        // 写入文件，设置权限为所有人可读写
        fs.writeFileSync(fullPath, JSON.stringify(full, null, 2), { mode: 0o666 });
        fs.chmodSync(fullPath, 0o666);

        // 设置文件夹权限
        if (!folderExists) {
            fs.chmodSync(poemDir, 0o777);
        }

        return { success: true };
    } catch (e) {
        return { success: false, reason: `创建文件失败: ${e.message}` };
    }
}

let ENABLE_LOG = false;

/**
 * 脚本入口。
 * 根据命令行参数选择执行 --add 或 --force 模式。
 */
function main() {
    const args = process.argv.slice(2);
    ENABLE_LOG = args.includes("--log");

    const forceNames = parseArgList(args, "force");
    GLOBAL_TAG_LIST = parseArgList(args, "tags");

    const isAddMode = args.includes("--add");
    const isForceMode = args.includes("--force");

    if (!isAddMode && !isForceMode) {
        console.error("❌ 请使用 --add 或 --force 运行此脚本");
        process.exit(1);
    }

    // --add 模式
    if (isAddMode) {
        console.log("🔍 开始添加模式...");
        const versions = ["junior", "senior"];
        const successList = [];
        const failList = [];

        for (const version of versions) {
            console.log(`\n📚 处理 ${version} 版本...`);
            const poemNames = loadOrder(version);

            for (const poemName of poemNames) {
                const result = createFullJson(version, poemName, false);

                if (result.success) {
                    successList.push(`${version}/${poemName}`);
                    console.log(`✅ 添加成功: ${version}/${poemName}`);
                } else if (result.reason === "文件已存在") {
                    // 文件已存在不算失败，只是跳过
                    // console.log(`⏭️  跳过: ${version}/${poemName} (文件已存在)`);
                } else {
                    failList.push(`${version}/${poemName}: ${result.reason}`);
                    console.log(`❌ 添加失败: ${version}/${poemName} - ${result.reason}`);
                }
            }
        }

        // 输出结果统计
        console.log("\n📊 添加模式结果统计:");
        console.log(`✅ 成功添加: ${successList.length} 个`);
        console.log(`❌ 添加失败: ${failList.length} 个`);

        if (failList.length > 0) {
            console.log("\n📋 失败详情:");
            failList.forEach(item => console.log(`  - ${item}`));
        }
    }

    // --force 模式
    if (isForceMode) {
        console.log("🔄 开始强制更新模式...");
        const versions = ["junior", "senior"];

        // 额外的跨版本强制列表（--force=A,B,C）
        const extraForceSet = new Set(forceNames);

        const successList = [];
        const failList = [];

        for (const version of versions) {
            console.log(`\n📚 处理 ${version} 版本...`);

            const mergedForceList = new Set([
                ...forceList[version],
                ...Array.from(extraForceSet)
            ]);

            for (const poemName of mergedForceList) {
                const result = createFullJson(version, poemName, true);

                if (result.success) {
                    successList.push(`${version}/${poemName}`);
                    console.log(`✅ 强制更新成功: ${version}/${poemName}`);
                } else {
                    failList.push(`${version}/${poemName}: ${result.reason}`);
                    console.log(`❌ 强制更新失败: ${version}/${poemName} - ${result.reason}`);
                }
            }
        }

        // 输出结果统计
        console.log("\n📊 强制更新模式结果统计:");
        console.log(`✅ 成功更新: ${successList.length} 个`);
        console.log(`❌ 更新失败: ${failList.length} 个`);

        if (failList.length > 0) {
            console.log("\n📋 失败详情:");
            failList.forEach(item => console.log(`  - ${item}`));
        }
    }
}

main();