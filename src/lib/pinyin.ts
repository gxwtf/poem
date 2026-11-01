/*
 * 拼音工具
 *
 * 背诵模式里「在电脑上输入隐藏字拼音的首字母就能显示该字」依赖这里取首字母。
 * 数据里的拼音带声调（zhī、ān、nǚ…），首字母本身可能就是带调字母，所以要归一化：
 *   - 带调字母取基础字母（ā/á/ǎ/à → a、ē/é/ě/è → e…），按键盘上那颗键算；
 *   - ü 系列（ü/ǖ/ǘ/ǚ/ǜ）按中文拼音输入法的习惯记作 v，而不是 u。
 *
 * 另外数据里还有「整词拼音挂在单字上」的脏值（「与妻书」的「前」pinyin="guòQián"、
 * 「窦娥冤」的「三」pinyin="guìzǐ"、「长恨歌」的「差」pinyin="intercross"）。
 * 这种值按首字母取会取到别的音节：敲该敲的键永远敲不开，敲错的键反而掀开答案。
 * 所以先判断「这个拼音字段是不是一个字的读音」，不是就当作没有拼音。
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

/** 元音字母（ü 系列已归一成 v，不算元音） */
const VOWELS = "aeiou";

/**
 * 把带调拼音归一成小写基础字母串：丢掉声调符号与非字母，ü 系列记作 v。
 * 归一之后才能数「元音串」个数（见 vowelRunCount）。
 */
function plainLetters(decomposed: string): string {
    let out = "";
    for (let i = 0; i < decomposed.length; i++) {
        const char = decomposed[i];
        if (isCombiningMark(char)) continue;
        // 分音符紧跟基础字母（ü = u + ¨）：按拼音输入法习惯记作 v，不当作元音
        if (decomposed.startsWith(DIAERESIS, i + 1)) out += "v";
        else if (char >= "a" && char <= "z") out += char;
        else if (char >= "A" && char <= "Z") out += char.toLowerCase();
    }
    return out;
}

/** 连续元音串的个数 */
function vowelRunCount(letters: string): number {
    let runs = 0;
    let inRun = false;
    for (const char of letters) {
        const isVowel = VOWELS.includes(char);
        if (isVowel && !inRun) runs++;
        inRun = isVowel;
    }
    return runs;
}

/**
 * 取拼音首字母（小写）。取不到（空拼音、标点占位「　」、多音节脏数据）时返回空串。
 *
 * 判定「是不是一个字的读音」用元音串个数：单音节必然只有一个连续元音串
 * （xiāo、zhuàng、guī、ér、hǎo 都是 1 串），而多音节拼在一起必然 ≥2 串
 * （guìzǐ、wǒmen、lǎotàitai、intercross），比「长度/大小写」这类启发式更稳。
 *
 * @example
 * pinyinInitial("zhī")     // "z"
 * pinyinInitial("ān")      // "a"：首字母带声调，按基础字母 a 算
 * pinyinInitial("ǚ")       // "v"：ü 记作 v
 * pinyinInitial("nǚ")      // "n"
 * pinyinInitial("Tài")     // "t"：数据里偶有首字母大写
 * pinyinInitial("guòQián") // ""：整词拼音挂在单字上，取哪个首字母都是错的
 * pinyinInitial("")        // ""
 */
export function pinyinInitial(pinyin: string | undefined): string {
    const trimmed = (pinyin ?? "").trim();
    if (!trimmed) return "";

    const letters = plainLetters(trimmed.normalize("NFD"));
    // 首字母不是拉丁字母（标点、数字、汉字）就没有可敲的键
    const base = letters[0];
    if (!base || base < "a" || base > "z") return "";
    // 多音节脏数据：取哪个首字母都是错的，宁可不参与键盘核对
    if (vowelRunCount(letters) >= 2) return "";

    return base;
}

/** 是否是「可以当作首字母输入」的按键：单个英文字母（不区分大小写） */
export function isLetterKey(key: string): boolean {
    return /^[a-z]$/i.test(key);
}
