/*
【一、脚本用途说明】

该脚本用于自动为古诗文的 full.json 文件生成注释。每一首古诗文的目录下需要放置一个 notes.mdx 文件，文件中包含所有注释内容。脚本会自动读取 notes.mdx，解析其中的注释，将其转换成结构化的注释数据，并写入对应的 full.json 文件。原来的注释会全部清空并被替换为新的注释。

脚本会自动遍历 junior 与 senior 两个版本下的古诗文目录，对每一个诗文文件夹执行注释写入操作。如果目录中没有 notes.mdx 文件，则跳过该诗文，不进行修改。

⸻

【二、notes.mdx 的书写格式要求】

Notes 文件采用行级注释格式，每一行表示一条注释。

每条注释必须包含两部分内容：
    1.	方括号内的“被注释词语”，可以包含汉字与拼音，但脚本会自动去除拼音。
    2.	方括号后的注释解释文本。

基本格式如下：
[词语或词组（拼音）]注释内容

说明：
（1）方括号必须成对出现。
（2）方括号中可以出现一个或多个词语，词语之间可用顿号、逗号等常见分隔符分隔。
（3）括号中的拼音会自动移除，不影响匹配。
（4）方括号后面的文字全部被视为注释内容，不做分隔处理。
（5）每一条注释必须独占一行。
（6）如有空行，将被自动忽略。

示例：
[青青子衿（jīn），悠悠我心]语出《诗经·郑风·子衿》，用于写思念之情。
[契阔谈讌（yàn）]意为久别重逢后的畅饮与交谈。

⸻

【三、注释与 full.json 的对应关系】

脚本会根据 notes.mdx 中的“词语”内容，自动找到该词语在 full.json 中对应句子的字符范围。

full.json 中每个句子由 content 字段提供逐字信息，每个字有一个 index。脚本通过句内字序列查找词语起点与终点位置，并将结果写入 notes 字段。

生成的注释格式如下：
start：词语在该句子中第一个字的 index
end：词语在该句子中最后一个字的 index
content：注释文本（来自方括号后的内容）

例如：
词语“对酒当歌”在句子中位于第 0 至第 3 个字，则注释写为：
start = 0
end = 3

脚本会将每个句子的 notes 数组全部清空，然后写入新的注释。

⸻

【四、脚本的工作流程】

（一）获取脚本所在位置，并定位 poem/junior 与 poem/senior 的数据目录。
（二）遍历每个诗文的文件夹。
（三）检查该文件夹是否包含 full.json。
（四）检查是否存在 notes.mdx，若没有则跳过该诗文。
（五）读取 full.json，并清空原有 notes 字段。
（六）读取 notes.mdx，将每一行解析成：关键词列表与注释内容。
（七）对每个关键词搜索所属诗文中的句子，找到对应的字符范围。
（八）将注释写入该句子的 notes 字段。
（九）将修改后的 full.json 写回原位置。
（十）继续处理下一首诗文。

⸻

【五、操作方式】

（一）确保脚本文件 add_notes.mjs 位于 scripts 目录下的 poem-content 子目录中。
（二）确保项目使用 Node.js 运行环境。
（三）在终端进入项目根目录。
（四）执行命令：
node scripts/poem-content/add_notes.mjs
（五）脚本将自动处理所有诗文，无需手动指定路径。
（六）处理完成后，会在终端输出成功或跳过的信息。

⸻

【六、注意事项】
    1.	notes.mdx 中的注释必须一行一条，方括号必须完整闭合。
    2.	注释中的拼音会被自动清除，不影响匹配。
    3.	同一条注释中的多个词语会被视为多个独立注释，分别写入 full.json。
    4.	关键词必须能够在句子中完整出现，否则不会写入。
    5.	若某些词语无法匹配任何句子，脚本不会报错，但也不会写入注释。
    6.	full.json 会被直接覆盖，请避免在脚本运行期间手动修改 full.json。
    7.	脚本不会生成 preview.json等文件，功能仅限注释写入 full.json。
*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const versions = ["junior", "senior"];

/**
 * 诗文过滤列表：
 * 若某版本数组为空，则处理该版本全部诗文；
 * 若数组非空，则只处理数组内指定的诗文文件夹名称。
 */
const poemList = {
    junior: [],
    senior: ["兼爱"]
};

/**
 * 支持参数： --list=junior,senior
 * 若提供该参数，则只处理指定的版本
 */
let useList = false;
let enableLog = false;

for (const arg of process.argv.slice(2)) {
    if (arg === "--list") {
        useList = true;
        console.log("📌 已启用 list 模式，将只按 poemList 过滤处理诗文");
    }
    if (arg === "--log") {
        enableLog = true;
        console.log("📘 已启用 log 模式");
    }
}

// 工具：移除拼音（括号中的内容）
function removePinyin(str) {
    return str.replace(/（.*?）/g, "");
}

// 工具：提取汉字
function extractChinese(str) {
    return str.replace(/[^\u4e00-\u9fa5]/g, "");
}

// 匹配关键词位置
function findKeywordInSentence(sentenceContent, keyword) {
    const chars = sentenceContent.map(c => c.char).join('');
    const idx = chars.indexOf(keyword);
    if (idx === -1) return null;
    return {
        start: idx,
        end: idx + keyword.length - 1
    };
}

for (const version of versions) {
    const basePath = path.join(__dirname, "../../src/data/poem", version);
    if (!fs.existsSync(basePath)) continue;

    const poemDirs = fs.readdirSync(basePath);
    let targetPoemDirs = poemDirs;
    if (useList && poemList[version] && poemList[version].length > 0) {
        targetPoemDirs = poemDirs.filter(name => poemList[version].includes(name));
        console.log(`📄 list 模式：版本 ${version} 仅处理：`, targetPoemDirs);
    }

    for (const dir of targetPoemDirs) {
        const poemPath = path.join(basePath, dir);
        const fullJsonPath = path.join(poemPath, "full.json");
        const notesPath = path.join(poemPath, "notes.mdx");

        if (!fs.existsSync(fullJsonPath)) continue;
        if (!fs.existsSync(notesPath)) {
            // console.log(`跳过：${dir}`);
            continue;
        }

        try {
            const full = JSON.parse(fs.readFileSync(fullJsonPath, "utf-8"));
            const originalJson = JSON.stringify(full, null, 2);
            const notesText = fs.readFileSync(notesPath, "utf-8").trim();

            // 解析 notes.mdx
            const notesList = notesText.split("\n").map(line => {
                const match = line.match(/\[(.*?)\](.*)/);
                if (!match) return null;

                const rawInside = match[1];
                const content = match[2].trim();

                // 先去掉拼音，整段内容视为一个连续的关键词（保留其中的标点）
                const noPinyin = removePinyin(rawInside);
                const keyword = noPinyin.trim();
                const keywords = keyword.length ? [keyword] : [];

                return { keywords, content };
            }).filter(Boolean);

            // 清空原 notes
            for (const para of full.paragraphs) {
                for (const sentence of para.sentences) {
                    sentence.notes = [];
                }
            }

            let lastGlobalIndex = -1;

            for (const { keywords, content } of notesList) {
                // 每条注释只允许添加一次
                let annotationFound = false;

                for (const kw of keywords) {
                    if (annotationFound) break;

                    for (const para of full.paragraphs) {
                        if (annotationFound) break;

                        for (const sentence of para.sentences) {
                            const pos = findKeywordInSentence(sentence.content, kw);
                            if (!pos) continue;

                            // 将句内局部 index 映射到全文 global index
                            const globalStart = sentence.content[pos.start].index;

                            // 只能匹配在上一个注释之后的位置
                            if (globalStart <= lastGlobalIndex) continue;

                            if (enableLog) {
                                console.log("🔍 匹配到注释：", content);
                                console.log("🔑 关键词：", kw);
                                console.log("📍 全文起始 index：", globalStart);
                                console.log("📝 所在句子：", sentence.content.map(c => c.char).join(''));
                                console.log("-----");
                            }
                            sentence.notes.push({
                                start: pos.start,
                                end: pos.end,
                                content
                            });

                            // 记录本条注释的全文结束位置
                            lastGlobalIndex = sentence.content[pos.end].index;

                            annotationFound = true;
                            break;
                        }
                    }
                }
            }

            // 比较修改后的内容与原内容
            const newJson = JSON.stringify(full, null, 2);
            if (newJson !== originalJson) {
                fs.writeFileSync(fullJsonPath, newJson);
                console.log(`🔄 更新：${dir}`);
            }

        } catch (e) {
            console.error(`❌ 处理 ${fullJsonPath} 出错：`, e);
        }
    }
}