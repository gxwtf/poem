import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 名称规范化函数
export function normalizeName(str) {
    return (str || "")
        .replace(/（.*?）/g, "")
        .replace(/\(.*?\)/g, "")
        .replace(/[《》]/g, "")
        .replace(/·/g, "")       // ← added for matching “燕歌行·并序” / “燕歌行并序”
        .replace(/\s+/g, "")
        .trim();
}

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

// 创建元数据映射
const metaMap = {
    junior: loadMeta("junior"),
    senior: loadMeta("senior")
};

// 查找匹配的元数据
export function findMeta(version, nameNormalized, fullData) {
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

        // 再子串匹配（如 full name "琵琶行并序" 应匹配 base name "琵琶行"）
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