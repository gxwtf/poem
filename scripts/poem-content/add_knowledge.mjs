/*
【一、脚本用途说明】

该脚本用于将古诗文目录下的 knowledge.mdx 文件导入 full.json 的 knowledge 字段。
每一首古诗文的目录下可以放置一个 knowledge.mdx 文件，文件内容即该诗的文言知识
（通假字、古今异义、一词多义、词类活用、特殊句式等，Markdown 格式）。脚本会自动
读取该文件，将内容写入对应 full.json 的 knowledge 字段，原字段被整体替换。

脚本会自动遍历 junior 与 senior 两个版本下的古诗文目录。如果目录中没有
knowledge.mdx 文件，则跳过该诗文，不进行修改。

⸻

【二、knowledge.mdx 的书写格式】

文件内容为 Markdown 文本，无特殊格式要求。建议使用 ### 标题划分板块，
条目使用 1. 2. 3. 编号，义项可用 ⑴ ⑵ ⑶ 等带圈数字。

示例：
### 通假字

1. 畔（pàn），通：“叛”，背叛。

### 古今异义

1. 城古义：内城今义：城市

说明：
（1）knowledge.mdx 是 knowledge 字段的唯一来源，文件为空或仅含空白时字段被清空。
（2）knowledge.mdx 中的文本必须是已转义、可直接嵌入 preview.mdx 的 MDX 安全文本
    （{ } ( ) < > 等特殊字符须写成 \{ \} \( \) \< \> 等，小节号前须断行）。
    该文件会被 Next.js 的 MDX 编译上下文直接扫到，含裸特殊字符会导致编译报错。
    新粘贴的原始文本请先按 full2mdx.mjs 顶部注释中的 encode 逻辑处理。

⸻

【三、脚本的工作流程】

（一）遍历 junior 与 senior 版本下的每个诗文文件夹。
（二）检查该文件夹是否包含 full.json 与 knowledge.mdx，缺一则跳过。
（三）读取 knowledge.mdx，统一换行符（\r\n → \n）并去除首尾空白。
（四）将内容写入 full.json 的 knowledge 字段。
（五）仅当内容发生变化时才写回 full.json，避免产生无意义的文件改动。

⸻

【四、操作方式】

（一）在项目根目录执行：
node scripts/poem-content/add_knowledge.mjs
（二）可选参数：--list 仅处理 poemList 中指定的诗文；--log 输出详细日志。
（三）run.sh 已在 add_notes 之后调用本脚本。

⸻

【五、注意事项】

1. ori2full.mjs 已不再覆盖 knowledge 字段，重新生成 full.json 不会丢失本脚本导入的内容。
2. 运行 full2mdx.mjs 前应先运行本脚本，以保证 preview.mdx 使用最新数据。
3. full.json 会被直接覆盖，请避免在脚本运行期间手动修改 full.json。
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
    senior: []
};

/**
 * 支持参数： --list
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
        const knowledgePath = path.join(poemPath, "knowledge.mdx");

        if (!fs.existsSync(fullJsonPath)) continue;
        if (!fs.existsSync(knowledgePath)) {
            // console.log(`跳过：${dir}`);
            continue;
        }

        try {
            const full = JSON.parse(fs.readFileSync(fullJsonPath, "utf-8"));
            const originalJson = JSON.stringify(full, null, 2);

            // 读取 knowledge.mdx：统一换行符，去除首尾空白
            const knowledgeText = fs.readFileSync(knowledgePath, "utf-8")
                .replace(/\r\n/g, "\n")
                .trim();

            if (enableLog) {
                console.log(`📝 ${dir}：读入 knowledge.mdx（${knowledgeText.length} 字符）`);
            }

            // 警告：检测未转义的 MDX 危险字符（裸 {} 会被当作 JSX 表达式，<字母 会被当作 JSX 标签）
            const unsafe = knowledgeText.match(/(^|[^\\])[{}]|<[A-Za-z]/);
            if (unsafe) {
                console.warn(`⚠️ ${dir}：knowledge.mdx 含未转义的特殊字符（${JSON.stringify(unsafe[0])}），嵌入 preview.mdx 后可能导致 MDX 编译报错`);
            }

            // knowledge.mdx 为唯一来源，整体替换（空文件即清空该字段）
            full.knowledge = knowledgeText;

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
