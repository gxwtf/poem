import OpenAI from 'openai';

const openai = new OpenAI({
	// baseURL: "https://openrouter.ai/api/v1",
	// apiKey: "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"
	baseURL: "https://tuxun.gxwtf.cn/v1",
	apiKey: "sk-dIwE5BCGLmKSB1ZThBvGMbYbR9BRTeCGrAjFcBjm07qtFVXz"
});

function removeThinkTags(input) {
    // 创建正则表达式匹配 <think> 和 </think> 之间的所有内容
    const regex1 = /<think>[\s\S]*?<\/think>/g;
	const regex2 = /<reason>[\s\S]*?<\/reason>/g;
    
    // 使用空字符串替换所有匹配项
    return input.replace(regex1, '').replace(regex2, '');
}

export default async function deepseekChat(prompt, unused) {
	// console.log('DeepSeek Chat: ' + prompt);

	try {
		const stream = await openai.chat.completions.create({
			// model: "qwen/qwen3-235b-a22b:free",
			// model: "deepseek/deepseek-r1-0528:free",
			// model: "deepseek/deepseek-chat-v3.1:free",
			// model: 'glm-4.6-fp8',
			model: 'Qwen3-Omni-30B-A3B-Instruct-AWQ-8bit',
			messages: [{ role: "user", content: prompt }],
			stream: true
		});

		let response = '';

		for await (const chunk of stream) {
			const content = chunk.choices[0]?.delta?.content || '';
			response += content;

			process.stdout.write((chunk.choices[0]?.delta.reasoning || '') + content);
		}
		
		return removeThinkTags(response);

	} catch (error) {
		console.error('API Error:', error);
		throw error;
	}
}