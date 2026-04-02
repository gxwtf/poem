"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { SiteHeader } from '@/components/site-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface CorrectAnswer {
    line: string;
    name: string;
    author: string;
}

interface GameData {
    gridData: string[][];
    correctAnswer: CorrectAnswer;
}

const GamePage: React.FC = () => {
    const [n, setN] = useState<number>(3);
    const [m, setM] = useState<number>(3);
    const [version, setVersion] = useState<string>('senior');
    const [gridData, setGridData] = useState<string[][]>([]);
    const [correctAnswer, setCorrectAnswer] = useState<CorrectAnswer | null>(null);
    const [selectedPoem, setSelectedPoem] = useState<string>('');
    const [showCorrectAnswer, setShowCorrectAnswer] = useState<boolean>(false);
    const [showActionButtons, setShowActionButtons] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [selectedButtons, setSelectedButtons] = useState<Set<string>>(new Set());

    // 获取游戏数据
    const startGame = async () => {
        setIsLoading(true);
        setShowCorrectAnswer(false);
        setSelectedPoem('');
        setShowActionButtons(true);
        setSelectedButtons(new Set());

        try {
            const response = await fetch(`/api/gridgame?n=${n}&m=${m}&version=${version}`);
            const data: GameData = await response.json();
            setGridData(data.gridData);
            setCorrectAnswer(data.correctAnswer);
        } catch (error) {
            console.error('Error starting game:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 初始化游戏
    useEffect(() => {
        startGame();
    }, []);

    // 选择诗句的字
    const selectPoem = (char: string, row: number, col: number) => {
        const buttonId = `${row}-${col}`;
        if (selectedButtons.has(buttonId)) return;

        setSelectedPoem(prev => prev + char);
        setSelectedButtons(prev => new Set(prev).add(buttonId));
    };

    // 渲染已选的诗句
    const renderWord = () => {
        return selectedPoem;
    };

    // 提交答案
    const submitAnswer = () => {
        setShowCorrectAnswer(true);
        setShowActionButtons(false);

        if (selectedPoem === correctAnswer?.line) {
            toast.success('回答正确！');
        } else {
            toast.error('回答错误！');
        }
    };

    // 放弃当前题目
    const giveUp = () => {
        setShowCorrectAnswer(true);
        setShowActionButtons(false);
        toast.info('您放弃了本题');
    };

    // 删除已选字的最后一个字
    const deleteLastChar = () => {
        if (selectedPoem.length === 0) return;

        setSelectedPoem(prev => prev.slice(0, -1));
        // 移除最后一个选中的按钮
        const buttonIds = Array.from(selectedButtons);
        const lastButtonId = buttonIds[buttonIds.length - 1];
        setSelectedButtons(prev => {
            const newSet = new Set(prev);
            newSet.delete(lastButtonId);
            return newSet;
        });
    };

    // 清空所有已选字
    const clearSelection = () => {
        setSelectedPoem('');
        setSelectedButtons(new Set());
    };

    return (
        <>
            <SiteHeader now="诗词九宫格" />
            <div className="p-2 sm:p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    {/* 游戏设置 */}
                    <div className="flex flex-wrap gap-4 justify-center mb-8 text-primary">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="gridSizex">行数</Label>
                            <Select value={n.toString()} onValueChange={(value) => setN(parseInt(value))}>
                                <SelectTrigger id="gridSizex" className="w-[100px]">
                                    <SelectValue placeholder="选择行数" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
                                        <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="gridSizey">列数</Label>
                            <Select value={m.toString()} onValueChange={(value) => setM(parseInt(value))}>
                                <SelectTrigger id="gridSizey" className="w-[100px]">
                                    <SelectValue placeholder="选择列数" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
                                        <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="version">版本</Label>
                            <Select value={version} onValueChange={setVersion}>
                                <SelectTrigger id="version" className="w-[150px]">
                                    <SelectValue placeholder="选择版本" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="junior">初中版</SelectItem>
                                    <SelectItem value="senior">高中版</SelectItem>
                                    <SelectItem value="combined">混合版</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button onClick={startGame} className="self-end">
                            新游戏
                        </Button>
                    </div>

                    {/* 游戏格子 */}
                    <Card className="p-6 mb-8 bg-background shadow-md">
                        {isLoading ? (
                            <div className="flex flex-col items-center">
                                {/* 模拟游戏格子的骨架屏 */}
                                <div className="grid grid-cols-1 gap-2 mb-8">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="flex gap-2 justify-center">
                                            {Array.from({ length: 3 }).map((_, j) => (
                                                <Skeleton key={`${i}-${j}`} className="w-12 h-12 rounded-md" />
                                            ))}
                                        </div>
                                    ))}
                                </div>

                                {/* 模拟已选诗句的骨架屏 */}
                                <div className="mb-8 text-center w-full max-w-lg">
                                    <Skeleton className="h-8 w-32 mx-auto mb-2 rounded-md" />
                                    <Skeleton className="h-12 w-full rounded-md" />
                                </div>

                                {/* 模拟操作按钮的骨架屏 */}
                                <div className="flex flex-wrap gap-4 justify-center">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <Skeleton key={i} className="h-10 w-20 rounded-md" />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                {/* 格子 */}
                                <div className="grid grid-cols-1 gap-2 mb-8">
                                    {gridData.map((row, i) => (
                                        <div key={i} className="flex gap-2 justify-center">
                                            {row.map((char, j) => {
                                                const buttonId = `${i}-${j}`;
                                                const isSelected = selectedButtons.has(buttonId);
                                                return (
                                                    <Button
                                                        key={buttonId}
                                                        onClick={() => selectPoem(char, i, j)}
                                                        disabled={isSelected}
                                                        className={`w-12 h-12 text-xl text-primary font-medium transition-all duration-200 ${isSelected
                                                            ? 'bg-foreground text-primary-foreground'
                                                            : 'bg-secondary hover:bg-secondary/80'
                                                            }`}
                                                    >
                                                        {char}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                {/* 已选诗句 */}
                                <div className="mb-8 text-center w-full max-w-lg">
                                    <h2 className="text-xl font-semibold mb-2 text-muted-foreground">已选诗句</h2>
                                    <div className="text-2xl font-medium min-h-12 py-2 text-foreground bg-secondary/50 rounded-md p-4">
                                        {renderWord()}
                                    </div>
                                </div>

                                {/* 操作按钮 */}
                                {showActionButtons && (
                                    <div className="flex flex-wrap gap-4 justify-center">
                                        <Button onClick={clearSelection} variant="secondary">
                                            清空
                                        </Button>
                                        <Button onClick={deleteLastChar} variant="secondary">
                                            删除
                                        </Button>
                                        <Button onClick={giveUp} variant="destructive">
                                            放弃
                                        </Button>
                                        <Button onClick={submitAnswer} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                            提交
                                        </Button>
                                    </div>
                                )}

                                {/* 答案对比 */}
                                {showCorrectAnswer && correctAnswer && (
                                    <>
                                        <div className="w-full">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* 用户答案 */}
                                                <Alert className="hidden md:block bg-secondary/50">
                                                    <AlertTitle className="text-xl font-semibold text-foreground">
                                                        你的答案
                                                    </AlertTitle>
                                                    <AlertDescription className="text-lg text-muted-foreground">
                                                        {selectedPoem} {selectedPoem === correctAnswer?.line ? '✅' : '❌'}
                                                    </AlertDescription>
                                                </Alert>

                                                {/* 正确答案 */}
                                                <Alert className="bg-secondary/50">
                                                    <AlertTitle className="text-xl font-semibold text-foreground">
                                                        正确答案
                                                    </AlertTitle>
                                                    <AlertDescription className="text-lg text-muted-foreground">
                                                        {correctAnswer.line}
                                                    </AlertDescription>
                                                    <AlertDescription className="text-muted-foreground">
                                                        {correctAnswer.name} {correctAnswer.author}
                                                    </AlertDescription>
                                                </Alert>
                                            </div>

                                            {/* Wordle风格逐字对比 */}
                                            <div className="mt-6 p-4 bg-secondary/30 rounded-lg">
                                                <div className="flex flex-wrap gap-2">
                                                    {correctAnswer.line.split('').map((correctChar, index) => {
                                                        const userChar = selectedPoem[index];
                                                        const isCorrectPosition = userChar === correctChar;
                                                        const isPresent = userChar && correctAnswer.line.includes(userChar);
                                                        const isMissing = !userChar;

                                                        return (
                                                            <span
                                                                key={index}
                                                                className={`px-3 py-2 rounded-md text-lg font-medium transition-all duration-200 ${isCorrectPosition
                                                                    ? 'bg-green-100 text-green-800 border border-green-300'
                                                                    : isMissing
                                                                        ? 'bg-gray-100 text-gray-400 border border-gray-300 italic'
                                                                        : isPresent
                                                                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                                                            : 'bg-gray-100 text-gray-600 border border-gray-300'
                                                                    }`}
                                                            >
                                                                {userChar || '_'}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-4 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="inline-block w-4 h-4 bg-green-100 border border-green-300 rounded"></span>
                                                        <span>字正确且位置正确</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="inline-block w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></span>
                                                        <span>字正确但位置错误</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="inline-block w-4 h-4 bg-gray-100 border border-gray-300 rounded"></span>
                                                        <span>字不存在于正确答案中</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <Button onClick={startGame} className="mt-8">
                                            下一题
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
};

export default GamePage;
