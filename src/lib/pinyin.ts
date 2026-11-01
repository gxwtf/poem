/*
 * 拼音工具
 *
 * 背诵模式里「在电脑上输入隐藏字拼音的首字母就能显示该字」依赖这里取首字母。
 * 数据里的拼音带声调（zhī、ān、nǚ…），首字母本身可能就是带调字母，所以要归一化：
 *   - 带调字母取基础字母（ā/á/ǎ/à → a、ē/é/ě/è → e…），按键盘上那颗键算；
 *   - ü 系列（ü/ǖ/ǘ/ǚ/ǜ）按中文拼音输入法的习惯记作 v，而不是 u。
 *
 * 为什么不用 /\p{M}/u 这类 Unicode 属性转义：项目 target 是 ES2017。
 */

/** 组合附加符号（声调符号、分音符等），按码位段判断 */
function isCombiningMark(char: string): boolean {
    const code = char.codePointAt(0) ?? 0;
    return (
        (code >= 0x0300 && code <= 0x036f) ||   // 常用组合符号（含 ˉ ˊ ˇ ˋ 与分音符 ¨）
        (code >= 0x1ab0 && code <= 0x1aff) ||
        (code >= 0x1dc0 && code <= 0x1dff) ||
        (code >= 0x20d0 && code <= 0x20f0)
    );
}

/** 分音符（ü 分解后就是这个符号） */
const DIAERESIS = "\u0308";

/**
 * 拼音字段是不是「一个字的读音」。
 *
 * 数据里偶有整词拼音挂在单字上的脏值（「与妻书」的「前」pinyin="guòQián"、
 * 「长恨歌」的「差」pinyin="intercross"、「刘姥姥进大观园」的「老」pinyin="lǎotàitai"），
 * 这类值按首字母取会取到别的音节：敲该敲的键永远敲不开，敲错的键反而掀开答案。
 * 所以宁可当作「没有拼音」（该字不参与键盘核对），也不给出错误的首字母。
 *
 * 判定：单音节最多 7 个字母，且除了首字母（数据里偶有 "Tài" 这种首字母大写）之外不再出现大写。
 */
function isSingleSyllable(pinyin: string): boolean {
    if (pinyin.length > 7) return false;
    if (/[A-Z]/.test(pinyin.slice(1))) return false;
    return true;
}

/**
 * 取拼音首字母（小写）。取不到（空拼音、标点占位「　」、脏数据）时返回空串。
 *
 * @example
 * pinyinInitial("zhī")     // "z"
 * pinyinInitial("ān")      // "a"：首字母带声调，按基础字母 a 算
 * pinyinInitial("ǚ")       // "v"：ü 记作 v
 * pinyinInitial("nǚ")      // "n"
 * pinyinInitial("guòQián") // ""：整词拼音挂在单字上，取哪个首字母都是错的
 * pinyinInitial("")        // ""
 */
export function pinyinInitial(pinyin: string | undefined): string {
    const trimmed = (pinyin ?? "").trim();
    if (!trimmed || !isSingleSyllable(trimmed)) return "";
    const raw = trimmed.toLowerCase();

    const decomposed = raw.normalize("NFD");
    const base = decomposed[0];
    // 首字符不是拉丁字母（标点、数字、汉字）就没有首字母可敲
    if (base < "a" || base > "z") return "";

    // 基础字母后面紧跟的组合符号决定它是不是 ü 系列（ü = u + 分音符）
    let marks = "";
    for (let i = 1; i < decomposed.length && isCombiningMark(decomposed[i]); i++) {
        marks += decomposed[i];
    }
    return marks.includes(DIAERESIS) ? "v" : base;
}

/** 是否是「可以当作首字母输入」的按键：单个英文字母（不区分大小写） */
export function isLetterKey(key: string): boolean {
    return /^[a-z]$/i.test(key);
}
