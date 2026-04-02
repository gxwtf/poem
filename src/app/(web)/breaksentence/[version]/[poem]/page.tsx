"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SiteHeader } from '@/components/site-header';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { Meta } from '@/components/poem-meta';

// 标点符号分类
const punctuation = {
    mustBreak: ['。', '，', '！', '？', '：', '；'], // 必须断
    canBreak: ['、'], // 可以断
    ignore: ['《', '》', '“', '”', "‘", "’", "—", "…"], // 忽略
};

// 处理文本，去除标点符号并生成断句信息
function processText(text: string) {
    const cleanText: string[] = [];
    const breakInfo: Array<{ index: number; type: 'mustBreak' | 'canBreak' }> = [];
    let currentIndex = 0; // 用于跟踪 cleanText 的字符位置

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (punctuation.mustBreak.includes(char)) {
            // 如果是最后一个字符的标点符号，标记为 canBreak
            if (i === text.length - 1) {
                breakInfo.push({ index: currentIndex - 1, type: 'canBreak' });
            } else {
                breakInfo.push({ index: currentIndex - 1, type: 'mustBreak' });
            }
        } else if (punctuation.canBreak.includes(char)) {
            breakInfo.push({ index: currentIndex - 1, type: 'canBreak' });
        } else if (!punctuation.ignore.includes(char)) {
            cleanText.push(char);
            currentIndex++;
        }
    }

    return { cleanText: cleanText.join(''), breakInfo };
}

// 根据断句信息生成断句后的诗句
function generateBrokenText(text: string, breaks: number[]) {
    const chars = text.split('');
    breaks.sort((a, b) => b - a); // 从后往前插入，避免索引偏移
    breaks.forEach(index => {
        chars.splice(index + 1, 0, '/');
    });
    return chars.join('');
}

// 从数据文件中获取古诗文
async function getPoemData(version: string, poemTitle: string) {
    try {
        // 根据版本和标题导入对应的古诗文数据
        const poemData = (await import(`@/data/poem/${version}/${poemTitle}/full.json`)).default;
        
        // 构建完整文本
        let fullText = '';
        poemData.paragraphs.forEach((paragraph: any) => {
            paragraph.sentences.forEach((sentence: any) => {
                sentence.content.forEach((charItem: any) => {
                    fullText += charItem.char;
                });
            });
        });
        
        return {
            title: poemData.name,
            author: poemData.author,
            dynasty: poemData.dynasty,
            content: fullText,
            version
        };
    } catch (error) {
        console.error('Error loading poem data:', error);
        throw error;
    }
}

// 断句游戏主组件
const BreakSentencePage: React.FC = () => {
    const params = useParams();
    const version = params.version as string;
    const poemTitle = decodeURIComponent(params.poem as string);
    
    const [poem, setPoem] = useState<{
        title: string;
        author: string;
        dynasty: string;
        content: string;
        version: string;
    } | null>(null);
    const [cleanText, setCleanText] = useState('');
    const [breakInfo, setBreakInfo] = useState<Array<{ index: number; type: 'mustBreak' | 'canBreak' }>>([]);
    const [userBreaks, setUserBreaks] = useState<Set<number>>(new Set());
    const [result, setResult] = useState<{
        correct: number;
        errors: number;
        missing: number;
        correctBreaks: number[];
        wrongBreaks: number[];
        missingBreaks: number[];
        userBrokenText: string;
        correctBrokenText: string;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 加载古诗文数据
    useEffect(() => {
        const loadPoem = async () => {
            try {
                const poemData = await getPoemData(version, poemTitle);
                setPoem(poemData);
                
                // 处理文本，生成断句信息
                const { cleanText: processedText, breakInfo: breaks } = processText(poemData.content);
                setCleanText(processedText);
                setBreakInfo(breaks);
            } catch (error) {
                console.error('Error loading poem:', error);
                toast.error('加载古诗文失败');
            } finally {
                setIsLoading(false);
            }
        };

        loadPoem();
    }, [version, poemTitle]);

    // 处理断句点击事件
    const handleBreakClick = (index: number) => {
        setUserBreaks(prev => {
            const newBreaks = new Set(prev);
            if (newBreaks.has(index)) {
                newBreaks.delete(index);
            } else {
                newBreaks.add(index);
            }
            return newBreaks;
        });
    };

    // 提交答案
    const submitAnswer = () => {
        if (!cleanText || !breakInfo) return;

        let correct = 0;
        let errors = 0;
        let missing = 0;

        const correctBreaks: number[] = [];
        const wrongBreaks: number[] = [];
        const missingBreaks: number[] = [];

        // 遍历断句信息，统计正确和漏标的断句
        breakInfo.forEach(({ index, type }) => {
            if (type === 'mustBreak') {
                if (userBreaks.has(index)) {
                    correct++;
                    correctBreaks.push(index);
                } else {
                    missing++;
                    missingBreaks.push(index);
                }
            } else if (type === 'canBreak') {
                // 可断可不断，不计入错误或漏标
                if (userBreaks.has(index)) {
                    correctBreaks.push(index); // 如果用户标了，视为正确
                }
            }
        });

        // 遍历用户断句，统计错误的断句
        userBreaks.forEach(index => {
            if (!breakInfo.some(b => b.index === index && (b.type === 'mustBreak' || b.type === 'canBreak'))) {
                errors++;
                wrongBreaks.push(index);
            }
        });

        // 生成断句后的诗句
        const userBrokenText = generateBrokenText(cleanText, [...userBreaks]);
        const correctBrokenText = generateBrokenText(cleanText, breakInfo.filter(b => b.type === 'mustBreak').map(b => b.index));

        setResult({
            correct,
            errors,
            missing,
            correctBreaks,
            wrongBreaks,
            missingBreaks,
            userBrokenText,
            correctBrokenText
        });
    };

    if (isLoading) {
        return (
            <div className="p-4 md:p-6">
                <SiteHeader now="句读知不知" />
                <div className="max-w-4xl mx-auto">
                    <div className="text-center py-16">
                        <div className="text-xl font-medium text-muted-foreground">加载中...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <SiteHeader data={[{ name: "古诗文", href: "/overview" }, { name: poemTitle, href: `/poem/${version}/${poemTitle}` }]} now="句读知不知" />
            <div className="flex-1">
                <div className="max-w-4xl mx-auto p-8">
                    {/* 古诗文信息 */}
                    {poem && <Meta title={poem.title} author={poem.author} dynasty={poem.dynasty} />}

                    {/* 断句区域 */}
                    <div className="mt-8 mb-8 cursor-pointer">
                        <div className="sentence-content text-2xl leading-13 text-primary">
                            {cleanText.split('').map((char, index) => {
                                const isCorrectBreak = result?.correctBreaks.includes(index);
                                const isWrongBreak = result?.wrongBreaks.includes(index);
                                const isMissingBreak = result?.missingBreaks.includes(index);
                                const isUserBreak = userBreaks.has(index);

                                return (
                                    <React.Fragment key={index}>
                                        <span className="inline-block mr-1">{char}</span>
                                        <span
                                            className={`sentence-gap inline-block w-6 h-6 ml-[-4px] mr-[4px] relative cursor-pointer transition-all duration-200 ${
                                                isUserBreak ? 'active' : ''
                                            } ${
                                                isCorrectBreak ? 'correct' : ''
                                            } ${
                                                isWrongBreak ? 'wrong' : ''
                                            } ${
                                                isMissingBreak ? 'missing' : ''
                                            }`}
                                            onClick={() => !result && handleBreakClick(index)}
                                            data-index={index}
                                        >
                                            {(isUserBreak || (result && isMissingBreak)) && (
                                                <span className={`absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl font-bold ${
                                                    isCorrectBreak ? 'text-green-600' : 
                                                    isWrongBreak ? 'text-red-600' : 
                                                    isMissingBreak ? 'text-yellow-600' : 'text-primary'
                                                }`}>
                                                    /
                                                </span>
                                            )}
                                        </span>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* 操作按钮 */}
                    {!result ? (
                        <div className="flex flex-wrap gap-4 justify-center mb-8">
                            <Button onClick={submitAnswer} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                提交答案
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* 统计信息 */}
                            <div className="text-center">
                                <div className="flex flex-wrap justify-center gap-6">
                                    <div>
                                        <span className="text-green-600 font-medium">正确：{result.correct}处</span>
                                    </div>
                                    <div>
                                        <span className="text-red-600 font-medium">错误：{result.errors}处</span>
                                    </div>
                                    <div>
                                        <span className="text-yellow-600 font-medium">遗漏：{result.missing}处</span>
                                    </div>
                                </div>
                            </div>

                            {/* 断句对比 */}
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-md font-medium text-muted-foreground mb-2">你的断句：</h4>
                                    <div className="p-4 text-center text-primary">
                                        {result.userBrokenText}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-md font-medium text-muted-foreground mb-2">正确断句：</h4>
                                    <div className="p-4 text-center text-primary">
                                        {result.correctBrokenText}
                                    </div>
                                </div>
                            </div>

                            {/* 图例 */}
                            <div className="bg-secondary/30 p-4 rounded-lg">
                                <h3 className="text-sm font-medium text-muted-foreground mb-3">图例说明</h3>
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block w-6 h-6 relative">
                                            <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-lg font-bold text-green-600">/</span>
                                        </span>
                                        <span className="text-sm text-primary">正确断句</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block w-6 h-6 relative">
                                            <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-lg font-bold text-red-600">/</span>
                                        </span>
                                        <span className="text-sm text-primary">错误标记</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block w-6 h-6 relative">
                                            <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-lg font-bold text-yellow-600">/</span>
                                        </span>
                                        <span className="text-sm text-primary">遗漏断句</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BreakSentencePage;
