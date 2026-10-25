/*
 * 中文标点符号分类与排版规则（依据《标点符号用法》GB/T 15834—2011）
 *
 * 为什么单独一份：
 * 古诗文预览把每个字渲染成独立的字格（[data-char]）以便注释、划线和背诵，
 * 字格是 inline-block，于是有两个副作用：
 *   1. 浏览器失去了中文断行的「禁则处理」（避头尾），标点会被排到行首；
 *   2. 标点宽度不再由字体自带的字身框决定，只能我们自己给。
 * 本文件集中提供分类、禁则与字格宽度依据，宽度值在 app/poem-preview.css。
 *
 * 国标要点（本文件据此实现）：
 *   - 点号：句号、问号、叹号、逗号、顿号、分号、冒号（占一个字位，墨迹靠左、
 *     右侧自然留白，所以「紧随前字」是正确排法，不能居中放大）
 *   - 标号：引号、括号、破折号、省略号、书名号、间隔号、连接号等
 *   - 破折号「——」、省略号「……」占两个字位，且不得拆到两行
 *   - 行首禁则：点号、后引号、后括号、后书名号不得出现在行首
 *   - 行尾禁则：前引号、前括号、前书名号不得出现在行尾
 *   - 标点挤压：连续的收尾标点（如 ？！”、。” ）共享字位，后一个向左侧挤压
 */

/** 标点类别 */
export type PunctKind =
    | "none"      // 正文（汉字、字母、数字等）
    | "dian"      // 点号：。 ， 、 ； ： ？ ！
    | "open"      // 开标号：前引号、前括号、前书名号
    | "close"     // 闭标号：后引号、后括号、后书名号
    | "dash"      // 破折号 / 一字线连接号：—
    | "ellipsis"  // 省略号：…
    | "mid"       // 间隔号：·
    | "space";    // 空白

/** 点号（行首禁则） */
const DIAN = "。，、；：？！﹑,;:?!.";

/** 开标号（行尾禁则） */
const OPEN = "“‘（(【〔［〈《「『『";

/** 闭标号（行首禁则） */
const CLOSE = "”’）)】〕］〉》」』";

/** 破折号 / 连接号（成对出现时按破折号处理） */
const DASH = "—―－‐-";

/** 省略号 */
const ELLIPSIS = "…";

/** 间隔号 */
const MID = "·・‧";

/** 折行用的换行符：断句时等同于标点 */
const NEWLINE = "\n\r";

/** 汉字（含 Ext-B/C 等罕见字，避免被误判成标点） */
const HAN = /\p{Script=Han}/u;

/** 返回标点的类别 */
export function punctKind(char: string | undefined): PunctKind {
    if (!char) return "none";
    if (char.length > 1) return HAN.test(char) ? "none" : "none";
    if (DIAN.includes(char)) return "dian";
    if (OPEN.includes(char)) return "open";
    if (CLOSE.includes(char)) return "close";
    if (DASH.includes(char)) return "dash";
    if (ELLIPSIS.includes(char)) return "ellipsis";
    if (MID.includes(char)) return "mid";
    if (char.trim() === "") return "space";
    return "none";
}

/** 是否是标点符号（换行按标点处理：用于断句/首字提示等背诵逻辑） */
export function isPunctuation(char: string | undefined): boolean {
    if (!char) return false;
    if (NEWLINE.includes(char)) return true;
    const kind = punctKind(char);
    return kind !== "none" && kind !== "space";
}

/**
 * 是否是「小句结束」的标点：点号，或紧跟着的收尾标号。
 * 诗词排版里应该优先在小句之间断行（一句一行），而不是把一个句子拆开。
 */
export function isClauseEnd(char: string | undefined): boolean {
    const kind = punctKind(char);
    return kind === "dian" || kind === "close";
}

/** 收尾类标点：不能出现在行首 */
export function isTrailingPunct(kind: PunctKind): boolean {
    return kind === "dian" || kind === "close";
}

/** 开头类标点：不能出现在行尾 */
export function isLeadingPunct(kind: PunctKind): boolean {
    return kind === "open";
}

/**
 * 把一「句」的字符切成不可断行的单元（避头尾处理）。
 *
 * 规则：
 *   1. 收尾标点（点号、后引号/后括号）永远跟在它前面的字后面，不得成为行首；
 *   2. 开标号（前引号/前括号）必须把它后面的一个字一起带上，不得成为行尾；
 *   3. 成对的破折号「——」、省略号「……」不得在中间断行。
 *
 * 返回每个单元包含的字符下标（升序）。
 */
export function groupChars(chars: string[]): number[][] {
    const units: number[][] = [];
    const kinds = chars.map(punctKind);
    let i = 0;

    while (i < chars.length) {
        const unit = [i];
        let last = i;
        i++;

        for (; ;) {
            if (i >= chars.length) break;
            const nextKind = kinds[i];

            // 收尾标点：跟着走
            if (isTrailingPunct(nextKind)) {
                unit.push(i);
                last = i;
                i++;
                continue;
            }
            // 上一个字是开标号：必须带上当前这个字
            if (isLeadingPunct(kinds[last])) {
                unit.push(i);
                last = i;
                i++;
                continue;
            }
            // 破折号 / 省略号成对（——、……），不可拆
            if ((kinds[last] === "dash" || kinds[last] === "ellipsis") && chars[i] === chars[last]) {
                unit.push(i);
                last = i;
                i++;
                continue;
            }
            break;
        }
        units.push(unit);
    }
    return units;
}

/**
 * 标点挤压：紧跟在另一个标点之后的收尾标点（或开标号之后的开标号）向左侧挤压，
 * 使「？！”」「。”」「“《」这类连续标点不至于各占满一个字位。
 */
export function computeSqueeze(chars: string[]): boolean[] {
    const kinds = chars.map(punctKind);
    return kinds.map((kind, i) => {
        if (i === 0) return false;
        const prev = kinds[i - 1];
        if (isTrailingPunct(kind) && isTrailingPunct(prev)) return true;
        if (isLeadingPunct(kind) && isLeadingPunct(prev)) return true;
        return false;
    });
}
