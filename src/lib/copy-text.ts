/*
 * 古诗文正文的「无感复制」
 *
 * 每个字都是一个独立的字格（[data-char]），注释还可能把字包进 flex 容器里，
 * 浏览器默认复制出来的纯文本会在字与字之间插入换行，无法直接粘贴使用。
 * 这里按字格里记录的原字重建纯文本：
 *   - 同一段落内直接拼接（中文不需要空格）
 *   - 段落之间、译文行之间用换行分隔
 *   - 拼音、注释、背诵占位符一律不进入剪贴板
 */

/** 从选区重建纯文本；没有选中正文时返回空串 */
export function buildPoemPlainText(root: HTMLElement, selection: Selection): string {
    const blocks: string[] = [];

    // .sentences / .translations 在 DOM 中是按段落顺序排列的
    root.querySelectorAll<HTMLElement>(".sentences, .translations").forEach((el) => {
        if (!selection.containsNode(el, true)) return;

        if (el.classList.contains("sentences")) {
            const chars = Array.from(el.querySelectorAll<HTMLElement>("[data-char]"))
                .filter((node) => selection.containsNode(node, true))
                .map((node) => node.dataset.char ?? "");
            if (chars.length > 0) blocks.push(chars.join(""));
        } else {
            // 译文是普通文本，直接取文本内容
            const text = (el.textContent ?? "").trim();
            if (text) blocks.push(text);
        }
    });

    return blocks.join("\n");
}
