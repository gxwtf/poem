import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { normalizeName, findMeta } from "./compare.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versions = ["junior", "senior"];

const forceArg = process.argv.find(arg => arg.startsWith("--force="));
const forceList = forceArg
    ? forceArg
          .replace("--force=", "")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)
    : null;


function hasAnyPinyin(full) {
    for (const para of full.paragraphs || []) {
        for (const sentence of para.sentences || []) {
            for (const ch of sentence.content || []) {
                if (ch.pinyin && ch.pinyin.trim() !== "") {
                    return true;
                }
                return false;
            }
        }
    }
    return false;
}

function isChineseChar(ch) {
    return /^[\u4e00-\u9fa5]$/.test(ch);
}

function main() {
    for (const version of versions) {
        const baseDir = path.join(__dirname, "../../src/data/poem", version);
        if (!fs.existsSync(baseDir)) continue;

        const poemDirs = fs.readdirSync(baseDir);

        for (const dir of poemDirs) {
            const fullPath = path.join(baseDir, dir, "full.json");
            if (!fs.existsSync(fullPath)) continue;

            let full;
            try {
                full = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
            } catch {
                continue;
            }

            // --force 指定时：只处理列表中的篇目
            if (forceList && !forceList.includes(full.name || dir)) {
                continue;
            }

            // 已有拼音：非 force 模式下才跳过
            if (!forceList && hasAnyPinyin(full)) continue;

            const nameNormalized = normalizeName(full.name || dir);

            let meta = null;
            meta = findMeta(version, nameNormalized, full);

            if (!meta || !meta.pinyin) {
                console.log(`[FAIL] ${dir}`);
                continue;
            }

            // force 模式：先清空原有拼音
            if (forceList) {
                for (const para of full.paragraphs || []) {
                    for (const sentence of para.sentences || []) {
                        for (const ch of sentence.content || []) {
                            ch.pinyin = "";
                        }
                    }
                }
            }

            let idx = 0;
            const pinyinList = meta.pinyin
                .split(/\s+/)
                .map(s => s.trim())
                .filter(s => s !== "");

            for (const para of full.paragraphs || []) {
                for (const sentence of para.sentences || []) {
                    for (const ch of sentence.content || []) {
                        if (isChineseChar(ch.char)) {
                            ch.pinyin = pinyinList[idx++] || "";
                        } else {
                            ch.pinyin = "";
                        }
                    }
                }
            }

            fs.writeFileSync(
                fullPath,
                JSON.stringify(full, null, 2),
                "utf-8"
            );

            console.log(`[OK] ${dir}`);
        }
    }
}

main();
