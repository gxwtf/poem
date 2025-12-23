/*
生成古诗文数据的脚本
运行方式：首先将 gxwtf_poem (原版) 克隆到 gxwtf_poem_react 的同级目录下，然后直接运行 node generate.mjs [options] 即可。
可选参数 (options)：
    --array: 从 array 数组中读取数据，而不是从文件中读取。此时你需要定义 array 数组，其中包括所有需要生成的古诗文名称。
*/

const array = {
    // junior: ["梅岭三章","狼","小圣施威降大圣","穿井得一人","杞人忧天","峨眉山月歌","江南逢李龟年","行军九日思长安故园","夜上受降城闻笛","秋词二首·其一","夜雨寄北","十一月四日风雨大作·其二","己亥杂诗·其五","竹里馆","春夜洛城闻笛","逢入京使","晚春","泊秦淮","贾生","过松源晨炊漆公店","约客","庭中有奇树","龟虽寿","赠从弟·其二","梁甫行","浣溪沙·一曲新词酒一杯","采桑子·轻舟短棹西湖好","相见欢·金陵城上西楼","如梦令·常记溪亭日暮","式微","子衿","送杜少府之任蜀州","望洞庭湖赠张丞相","题破山寺后禅院","送友人","卜算子·黄州定慧院寓居作","卜算子·咏梅","智取生辰纲","范进中举","三顾茅庐","刘姥姥进大观园","月夜忆舍弟","长沙过贾谊宅","左迁至蓝关示侄孙湘","商山早行","咸阳城东楼","行香子·树绕村庄","丑奴儿·书博山道中壁","定风波·莫听穿林打叶声","临江仙·夜登小阁忆洛中旧游","太常引·建康中秋夜为吕叔潜赋","浣溪沙·身向云山那畔行","南安军","别云间","山坡羊·骊山怀古","朝天子·咏喇叭"],
    // senior: ["芣苢","插秧歌","齐桓晋文之事","庖丁解牛","烛之武退秦师","鸿门宴","窦娥冤","与妻书","促织","苏武传","燕歌行·并序","氓","孔雀东南飞","石钟山记","长恨歌","九歌·湘夫人","咏怀八十二首·其一","杂诗十二首·其二","越中览古","一剪梅·红藕香残玉簟秋","今别离·其一","夜归鹿门山歌","菩萨蛮·人人尽说江南好","积雨辋川庄作","旅夜书怀","新城道中·其一","阁夜","苏幕遮·燎沉香","九歌·国殇","登柳州城楼寄漳汀封连四州","菩萨蛮·小山重叠金明灭","般涉调·哨遍·高祖还乡","过小孤山大孤山","项羽之死","方山子传","大铁椎传","祭十二郎文","狱中杂记","陶庵梦忆序","春夜宴从弟桃花园序","游沙湖","苦斋记"]
    junior: [],
    senior: ["静夜思"]
};
// 定义 array 数组，其中包含所有需要生成的古诗文名称。这个数组仅在指定 --array 参数时有效。

process.on('uncaughtException', (err) => {
    console.error(err);
})

import ds from '../poem-content-wck/deepseek.mjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 格式示例

const example = {
    "name": "登幽州台歌",
    "author": "陈子昂",
    "dynasty": "唐代",
    "mode": "poem",
    "paragraphs": [
        {
            "sentences": [
                {
                    "content": "前不见古人，后不见来者。",
                    "translation": "向前看不见古代的贤君，向后看不见未来的才俊。",
                    "pinyin": "qián bù jiàn gǔ rén ， hòu bù jiàn lái zhě。"
                }
            ]
        },
        {
            "sentences": [
                {
                    "content": "念天地之悠悠，独怆然而涕下！",
                    "translation": "想天地浩渺悠远，独自悲伤流下眼泪！",
                    "pinyin": "niàn tiān dì zhī yōu yōu ，dú chuàng rán ér tì xià ！"
                }
            ]
        }
    ]
}
const example2 = {
    notes: [
        { start: 3, end: 4, content: '古人：古代贤人，此处特指像燕昭王那样的明君。' },
        { start: 5, end: 5, content: '后：未来、后来，指时间上的相继。' },
        { start: 8, end: 9, content: '来者：未来的人，即后继的贤才。者，与‘来’构成复合代词。' },
        { start: 10, end: 10, content: '念：想到、思念，此处引申为感慨宇宙人生的无尽。' },
        {
            start: 13,
            end: 13,
            content: '之：结构助词，取消句子独立性，使‘天地悠悠’成为名词性短语作宾语。'
        },
        { start: 14, end: 15, content: '悠悠：同叠词，形容天地辽阔、时光绵长。' },
        { start: 17, end: 18, content: '怆然：表示悲伤的样子。怆，伤感；然，状态形容词后缀。' },
        { start: 20, end: 21, content: '涕下：落泪。‘涕’现代多指鼻涕，古文特指泪水，‘下’表动作。' }
    ],
    different_meanings: [{ start: 20, end: 20, old: '眼泪', new: '鼻涕' }],
    special_sentences: [
        {
            start: 20,
            end: 20,
            content: '‘涕下’中的‘下’为动词，结构上与现代汉语的‘流泪’异于文言细微表达。'
        }
    ],
    read: [17, 20],
    write: [17, 20]
};

// prompt

const prompt1 = `你是一个高效的AI格式生成器，专门处理古诗文信息。用户将会提供一首古诗文的信息。其中可能包括古诗文名称、作者、朝代、内容、译文等输入，也有可能只包含古诗文的名称，你需要自行生成其余信息。你的任务是根据输入直接生成一个严格的JSON格式输出。

输出格式（必须严格遵守）：

{
    "name": "古诗文名称",
    "author": "作者",
    "dynasty": "朝代",
    "mode": "poem|paragraph",
    "tags": [
        "语文教材简称",
        "体裁",
        "背默（可选）"
    ]
    "paragraphs": [
        {
            "sentences": [
                {
                    "content": "句子内容（含标点）",
                    "translation": "现代汉语翻译（含标点，拼音中无空格）",
                    "pinyin": "拼音（标点符号前后有空格）"
                }
            ]
        }
  ]
}


关键规则：

1. 范围：
出现或曾经出现在由中华人民共和国教育部编纂的部编版语文中学教材中的文言课文，包括但不限于诗、词、曲、赋、文言文、戏剧、小说。
2. 标题：
给出的题目是按照语文教材中的课文标题进行命名，避免使用中文或其他非标准字符，不需要特殊处理重复的文言文标题。如：论语十二章不需要添加（初中版）或（高中版）。
3. 作者 & 朝代：
严格按照语文教材中的作者进行命名，避免使用中文或其他非标准字符。
4. 模式 ：
- \`mode\` 为 \`poem\` 的情况：绝句和律诗、较短的歌行体古诗
- \`mode\` 为 \`paragraph\` 的情况：包括但不限于较长的歌行体的古诗、词、文言文、曲、戏剧、小说。
- 定义：较短的 **歌行体古诗文** 为篇幅小于等于《春江花月夜》的歌行体古诗。
5. 原文：
严格按照语文教材中的原文进行编辑，如有不同版本的区别，一律按语文教材为准。避免使用中文或其他非标准字符。
注意：为区分正文和“序”，暂且不区分“序”和正文。
6. 标签：
- 第一个标签必须为古诗文（曾经）所在的语文教材的名字。如：《九上》《必修上》《选必下》
- 第二个标签必须为古诗文的体裁。如：诗、词、赋、曲、文言文、戏剧、小说。
- 如果古诗文需要背诵和默写，则第三个标签标注为“背默”，需要背诵和默写的定义是在通常意义下中高考要求背诵和默写的古诗文。
7. 断句：以句号、感叹号、问号作为句子分隔符。特别地，用户可能提供了古诗文原文，它可能已经提供了标点符号，此时需要以原文的标点符号为主。请忽略掉原文中的所有换行。
8. 分段：对于一个 sentences 数组内部就是一个段落，这个分段需要严格按照语文教材进行分段；所有 \`mode\` 为 \`poem\` 的情况，是的每一行（每一句）都是一个段落。
8. 拼音格式：标点符号前后必须加空格（例如：wǒ ài nǐ 。）。
9. 内容与翻译：整段无空格，直接使用输入提供的参考信息，但需校正格式。
10. 输出：仅输出纯文本JSON，无任何额外标记（如 \`\`\`json）。

推理步骤（高效执行，无需冗长思考）：

1.  识别类型：根据输入快速判断是古诗还是古文。
2.  解析句子：直接以用户提供的数据中的标点（。！？）分割内容为句子。也就是说，每一个 sentence 对象的 content 的最后一个标点符号必须是 “。！？” 三者之一。请尊重原文，不得私自增加或修改标点符号。特别地，对于逗号，我们不认为它是句子的分隔符。
3.  如果用户提供的数据中没有标点，你需要自己设计标点（<reason></reason> 的时候），并按照自己设定的标点和规则2断句。
4.  构建结构：按分段规则填充paragraphs和sentences。
5.  生成JSON：直接映射输入数据到JSON字段，确保格式准确。

严格禁止以下行为：
1. 将原文中的逗号自行修改为句号，并在此处断句，标点符号需要严格按照语文教材上的进行输入。例如，对于“前不见古人，后不见来者。”这样的句子，你不得自行修改为“前不见古人。后不见来者。”这样的句子。同时，对于“前不见古人，后不见来者。”，你只能在最后一个句号处断句，中间不得断句。

请严格按照下列格式输出：

<reason>
    你的思考过程，包括对上述规则的理解，以及如何分段（仔细思考，并认真遵守上述规则2、3、禁令1 和下列格式示例）、如何添加拼音和翻译
</reason>
你的最终输出，需要与推理过程一致，并严格遵守上述格式。

格式示例如下：
${JSON.stringify(example, null, 2)}

`;
const prompt2 = `你是一个 AI 数据生成器，用户将会提供一个字符串，这个字符串是 **标注了下标** 的古诗文数据。你需要生成以下内容(JSON)：
{
    notes: [ // 注释列表
        {
            start: start_index, // 注释的起始下标，为闭区间
            end: end_index, // 注释的结束下标，为闭区间
            content: "注释内容"
        },
        ...
    ],
    different_meanings: [ // 古诗文中所有的古今异义词
        start: start_index, // 起始下标，为闭区间
        end: end_index, // 结束下标，为闭区间
        old: "古代含义",
        new: "现代含义"
    ],
    special_sentences: [ // 所有的特殊句式，包括宾语前置、状语后置等
        start: start_index,
        end: end_index,
        content: "XXX" // 属于什么特殊句式
    ],
    read: [...], // 所有易读错的字的下标列表
    write: [...] // 所有易写错的字的下标列表
}

注意事项：

1. 以纯文本格式输出，不得出现 \`\`\`json 等特殊标记。
2. 注释要尽可能全面，需要标注出所有可能出错的地方，不宜过少，也不宜过多（对于一些比较简单的词，无需添加注释）。
3. 内容必须绝对准确，不得编造。
4. 你需要默认用户为高中水平，对于一些简单的字词，无需添加注释。（如“之” “也” “亦” 等）这一点非常重要哦！！！
5. 要尽可能缩小注释的范围，如果要给一个词打注释，只需要将 start 和 end 设置为这个词的起始/结束下标即可，无需把整句话都打上注释。
6. 不要每一个字都打一个注释！打注释之前仔细想想有没有必要（你面前是一位高中生）。

**请认真学习格式示例后再生成内容。**

格式示例：
<reason>
    你的思考过程，包括哪些词需要打注释，哪些词由于过于简单，无需注释。尽可能详细
</reason>

${JSON.stringify(example2, null, 2)}`

function removeDigits(str) {
    return str.replace(/\d/g, '');
}

function addKey(response1, l, r, key1, key2, value) {
    for (let i in response1.paragraphs) {
        for (let j in response1.paragraphs[i].sentences) {
            if (l < 0 && r >= 0) throw new Error(`Invalid range ${l} ${r} ${key1} ${key2} ${value}`);
            let obj = response1.paragraphs[i].sentences[j];
            console.log(obj.content.length, l, r);
            if (obj.content.length > r) {
                if (!obj[key1]) response1.paragraphs[i].sentences[j][key1] = new Array();
                response1.paragraphs[i].sentences[j][key1].push({
                    start: l,
                    end: r,
                    [key2]: value
                });
                return response1;
            } else l -= obj.content.length, r -= obj.content.length;
        }
    }
    throw new Error('not found');
}

let skipPrompt2 = false;

async function generate(poemdata) {
    // console.log(poemdata);
    // process.exit(0);
    poemdata = poemdata.replaceAll('\n', '');
    console.log(poemdata);
    let response1;
    while (1) {
        try {
            response1 = JSON.parse(await ds(prompt1 + '\n\n' + poemdata, 'deepseek/deepseek-chat-v3.1:free'));
            break;
        } catch (error) { console.error(error); }
    }
    console.log(response1);
    let merged = '';
    let cnt = 0;
    for (let i in response1.paragraphs) {
        // console.log(response1.paragraphs[i]);
        for (let j in response1.paragraphs[i].sentences) {
            let obj = response1.paragraphs[i].sentences[j];
            console.log(obj);
            for (let k = 0; k < obj.content.length; k++)
                merged += `${cnt++}${obj.content[k]}`;
        }
    }

    let response2 = { notes: [], different_meanings: [], special_sentences: [], read: [], write: [] };
    if (skipPrompt2) {
        console.log("Skipping prompt2... (no notes / meanings / special sentences generated)");
    } else {
        while (1) {
            try {
                response2 = JSON.parse(await ds(prompt2 + '\n\n' + merged, 'deepseek/deepseek-chat-v3.1:free'));

                for (let i in response2.notes)
                    response1 = addKey(response1, response2.notes[i].start, response2.notes[i].end, 'notes', 'content', response2.notes[i].content);

                for (let i in response2.different_meanings) {
                    response1 = addKey(response1, response2.different_meanings[i].start, response2.different_meanings[i].end, 'different_meanings', 'old', response2.different_meanings[i].old);
                    response1 = addKey(response1, response2.different_meanings[i].start, response2.different_meanings[i].end, 'different_meanings', 'new', response2.different_meanings[i].new);
                }

                for (let i in response2.special_sentences)
                    response1 = addKey(response1, response2.special_sentences[i].start, response2.special_sentences[i].end, 'special_sentences', 'content', response2.special_sentences[i].content);

                // Force disable read/write generation
                response2.read = [];
                response2.write = [];

                break;
            } catch (error) { console.error(error); }
        }
    }

    // read / write are no longer generated
    let read = new Set();
    let write = new Set();

    cnt = 0;
    for (let i in response1.paragraphs)
        for (let j in response1.paragraphs[i].sentences) {
            let obj = response1.paragraphs[i].sentences[j];
            if (!obj.tmp_content) obj.tmp_content = new Array();
            for (let k = 0; k < obj.content.length; k++) {
                obj.tmp_content.push({
                    char: obj.content[k],
                    pinyin: obj.pinyin.split(' ')[k],
                    index: cnt,
                    read: read.has(cnt),
                    write: write.has(cnt)
                });
                cnt++;
            }
        }

    for (let i in response1.paragraphs)
        for (let j in response1.paragraphs[i].sentences) {
            response1.paragraphs[i].sentences[j].content = response1.paragraphs[i].sentences[j].tmp_content;
            delete response1.paragraphs[i].sentences[j].tmp_content;
        }

    console.log(JSON.stringify(response1, null, 2));
    return response1;
}

async function main(version) {
    let arrayMode = process.argv.includes('--array');
    skipPrompt2 = process.argv.includes('--skip2');
    const files = (arrayMode ? array[version].map((item) => item + '.txt') : fs.readdirSync(path.join(__dirname, '../../src/data/poem', version)));
    for (let i = 0; i <= files.length - 1; i++) {
        const file = files[i];
        if (!file.endsWith('.txt')) continue;
        let poemname = removeDigits(file.replace('.txt', ''));
        const dir = path.join(__dirname, '../../src/data/poem', version, poemname);
        // create directory dir
        fs.mkdirSync(dir, { recursive: true });
        // make directory readable and writable by everyone
        fs.chmodSync(dir, 0o777);

        const fileContent = (arrayMode ? array[version][i] : fs.readFileSync(path.join(__dirname, '../../gxwtf_poem/src/data/poem', version, file), 'utf8'));

        let JSONfile = path.join(dir, 'full.json');
        // 如果已经存在JSON文件，则跳过
        if (fs.existsSync(JSONfile)) continue;

        console.log(poemname);

        try {
            fs.writeFileSync(JSONfile, JSON.stringify(await generate(fileContent), null, 2));
            // make the generated file readable and writable by everyone
            fs.chmodSync(JSONfile, 0o666);
            // process.exit(0);
            // console.log('success');
        } catch (error) {
            console.error(error);
            i--;
            continue;
        }
    }

    // console.log(JSON.stringify(array, null, 2));
};
// generate('登幽州台歌');

main('junior').then(main('senior'));