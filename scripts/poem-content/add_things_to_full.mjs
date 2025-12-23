/**
 * 本脚本用于将 junior.json / senior.json 中的拓展信息
 * 自动补充到 /src/data/poem/[version]/[poem]/full.json 中。
 *
 * 功能说明：
 * ---------------------------------------------------------
 * 1. 支持添加的字段列表（FIELDS）
 *    - 仅在 full.json 中不存在时才添加。
 *
 * 2. 支持强制覆盖字段列表（FORCE_FIELDS）
 *    - full.json 中已有同名字段时，只在新旧值不相等时覆盖并计入修改。
 *
 * 3. 匹配规则（findMeta）：
 *    - （1）精确匹配：
 *          full.json.name 与 meta.name 规范化后完全一致。
 *
 *    - （2）前缀匹配：
 *          如"南乡子" 需匹配 "南乡子·登京口北固亭有怀"。
 *          匹配前会进行 normalizeName 处理。
 *
 *    - （3）子串匹配（双向）：
 *          "琵琶行" ⇆ "琵琶行并序"
 *          "老子四章" ⇆ "《老子》四章"
 *          只要两者规范化后为包含关系即可。
 *
 *    - 注意：前缀/子串匹配时必须校验作者一致。
 *
 * 4. normalizeName 规范化规则：
 *    - 去除中文全角括号（……）
 *    - 去除英文括号(...)
 *    - 去除《》书名号
 *    - 去除所有空白字符
 *    - 统一 trim()
 *
 * 5. 输出说明：
 *    - 每当 full.json 产生有效修改时，会打印：
 *          "✅ 更新 [诗名]"
 *    - 未修改的文件不会输出任何内容。
 *
 * 6. 文件结构假设：
 *    src/data/poem/
 *        ├── junior/
 *        │     └── [某一诗文]/
 *        │           └── full.json
 *        └── senior/
 *              └── [某一诗文]/
 *                    └── full.json
 *
 * 该脚本可用于：
 * - 自动同步古诗文背景、鉴赏类文本
 * - 批量维护 full.json 结构
 * - 避免人工手动打开几十上百个诗文文件逐条修改
 *
 * 注意：
 * - 本脚本不会创建缺失的 full.json 或诗文目录。
 * - 本脚本不会覆盖未添加在 FORCE_FIELDS 中的已有字段。
 * - full.json 内 name 字段缺失时，该条目会被跳过。
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 要添加的字段
function normalizeName(str) {
    return (str || "")
        .replace(/（.*?）/g, "")
        .replace(/\(.*?\)/g, "")
        .replace(/[《》]/g, "")
        .replace(/·/g, "")       // ← added for matching “燕歌行·并序” / “燕歌行并序”
        .replace(/\s+/g, "")
        .trim();
}
// 在这里填写需要添加的字段
const FIELDS = ["background", "appreciation"];

// 在这里填写需要强制覆盖的字段
const FORCE_FIELDS = [
    "background",
    "appreciation"
];

// 读取 junior.json 和 senior.json
function loadMeta(version) {
    const filePath = path.join(__dirname, `${version}.json`);
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
        console.error(`❌ 加载 ${version}.json 失败`, e);
        return [];
    }
}

const metaMap = {
    junior: loadMeta("junior"),
    senior: loadMeta("senior")
};

function findMeta(version, nameNormalized, fullData) {
    const list = metaMap[version] || [];

    // ① 先精确名称匹配
    let item = list.find(item => normalizeName(item.name) === nameNormalized);
    if (item) return item;

    // ② 如果 fullData.author 存在，则进行作者辅助匹配
    if (fullData && fullData.author) {
        const author = normalizeName(fullData.author);

        // 先前缀匹配（如 “南乡子” 匹配 “南乡子·登京口北固亭有怀”）
        item = list.find(entry =>
            normalizeName(entry.name).startsWith(nameNormalized) &&
            normalizeName(entry.author || "") === author
        );
        if (item) return item;

        // 再子串匹配（如 full name “琵琶行并序” 应匹配 base name “琵琶行”）
        item = list.find(entry => {
            const entryName = normalizeName(entry.name);
            const baseName = nameNormalized;

            return (
                entryName.includes(baseName) || baseName.includes(entryName)
            ) && normalizeName(entry.author || "") === author;
        });
        if (item) return item;
    }

    return null;
}

const versions = ["junior", "senior"];

for (const version of versions) {
    const basePath = path.join(__dirname, "../../src/data/poem", version);
    if (!fs.existsSync(basePath)) continue;

    const poemDirs = fs.readdirSync(basePath);

    for (const dir of poemDirs) {
        const folder = path.join(basePath, dir);
        const fullPath = path.join(folder, "full.json");

        if (!fs.existsSync(fullPath)) continue;

        let fullData;
        try {
            fullData = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        } catch (e) {
            console.error(`❌ 无法读取 ${fullPath}`, e);
            continue;
        }

        const rawName = fullData.name;
        const poemName = normalizeName(rawName);
        if (!poemName) continue;

        const meta = findMeta(version, poemName, fullData);
        if (!meta) continue;

        let modified = false;

        for (const field of FIELDS) {
            if (meta[field]) {
                if (FORCE_FIELDS.includes(field)) {
                    if (fullData[field] !== meta[field]) {
                        fullData[field] = meta[field];   // 强制覆盖且值不同才算修改
                        modified = true;
                    }
                } else if (fullData[field] === undefined) {
                    fullData[field] = meta[field];       // 仅在不存在时添加
                    modified = true;
                }
            }
        }

        if (modified) {
            fs.writeFileSync(fullPath, JSON.stringify(fullData, null, 2), "utf-8");
            console.log(`✅ 更新 ${poemName}`);
        }
    }
}