// 古诗文背诵组件

"use client";

import { useContext, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CircleQuestionMark, Brain, Lightbulb, EyeOff, Rows3 } from "lucide-react";
import {
    clamp01,
    isCharHideMode,
    isFirstCharMode,
    isSentenceHideMode,
    MEMORIZE_FIRST_CHAR,
    MemorizeContext,
    sentenceHideDifficulty,
    sentenceHideValue,
} from "./memorize-context";

/**
 * 进入背诵模式前同步清除正文的高亮属性。
 * 必须在 setMemorize 之前、React 渲染前完成，否则旧 rAF 闭包会重新应用高亮导致崩溃
 */
function suspendHighlight() {
    (window as unknown as Record<string, unknown>).__poemMemorizeMode = true;
    document.querySelectorAll("[data-char][data-highlight-id]").forEach((el) => {
        if (el instanceof HTMLElement) {
            delete el.dataset.highlightId
            delete el.dataset.charOffset
        }
    })
}

/** 背诵方式按钮：图标 + 名称 + 一行说明 */
function ModeButton({
    icon,
    title,
    hint,
    onClick,
}: {
    icon: React.ReactNode
    title: string
    hint: string
    onClick: () => void
}) {
    return (
        <Button
            variant="outline"
            onClick={onClick}
            className="h-auto w-full justify-start gap-3 px-3 py-2 text-left whitespace-normal"
        >
            {icon}
            <span className="flex flex-col items-start gap-0.5">
                <span className="text-sm">{title}</span>
                <span className="text-muted-foreground text-xs font-normal">{hint}</span>
            </span>
        </Button>
    );
}

export function Memorize() {
    const { memorize, setMemorize } = useContext(MemorizeContext);
    // 隐藏难度（0~1）：两种随机隐藏模式共用，非法输入回退到 0.5
    const [difficultyText, setDifficultyText] = useState("0.5");
    const parsedDifficulty = parseFloat(difficultyText);
    const difficulty = isNaN(parsedDifficulty) ? 0.5 : clamp01(parsedDifficulty);

    function enterMode(mode: number) {
        suspendHighlight();
        setMemorize(mode);
    }

    function quitMemorizeMode() {
        delete (window as unknown as Record<string, unknown>).__poemMemorizeMode;
        setMemorize(NaN);
    }

    if (isNaN(memorize)){
        return (
            <>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="text-primary flex items-center gap-2">
                            <Brain className="w-4 h-4" />
                            <span className="hidden sm:inline">背诵</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72">
                        <h4 className="flex items-center gap-2 font-medium">
                            <Brain className="w-4 h-4" />
                            背诵古诗文
                        </h4>
                        <p className="text-muted-foreground mt-1 text-xs">
                            选择一种方式开始背诵，按住鼠标左键划过空白处可查看答案。
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                            <Label htmlFor="difficulty" className="flex items-center gap-1 text-sm">
                                <Popover>
                                    <PopoverTrigger className="flex items-center gap-1">
                                        隐藏难度<CircleQuestionMark className="w-4 h-4" />
                                    </PopoverTrigger>
                                    <PopoverContent>
                                        <p>
                                            隐藏难度是一个 (0,1] 之间的实数：随机隐藏单字时，表示每个字被隐藏的概率；
                                            随机隐藏整句时，表示每一句被隐藏的概率。该值越大，难度越高。
                                        </p>
                                    </PopoverContent>
                                </Popover>
                            </Label>
                            <Input
                                type="number"
                                id="difficulty"
                                min="0"
                                max="1"
                                step="0.1"
                                className="h-8 w-20 text-center"
                                value={difficultyText}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setDifficultyText(e.currentTarget.value)
                                }}
                                // 失焦时收敛非法/越界输入，避免「显示 1.5 实际按 1 隐藏」的困惑
                                onBlur={() => setDifficultyText(String(difficulty))}
                            />
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                            <ModeButton
                                icon={<EyeOff className="w-4 h-4" />}
                                title="随机隐藏单字"
                                hint="每个字按难度随机隐藏"
                                onClick={() => enterMode(difficulty)}
                            />
                            <ModeButton
                                icon={<Rows3 className="w-4 h-4" />}
                                title="随机隐藏整句"
                                hint="按标点断句，整句随机隐藏"
                                onClick={() => enterMode(sentenceHideValue(difficulty))}
                            />
                            <ModeButton
                                icon={<Lightbulb className="w-4 h-4" />}
                                title="首字提示"
                                hint="只显示每句的首字"
                                onClick={() => enterMode(MEMORIZE_FIRST_CHAR)}
                            />
                        </div>
                    </PopoverContent>
                </Popover>
            </>
        );
    }

    // 各背诵模式都显示结束按钮，并在按钮上标注当前方式与难度
    const modeName = isFirstCharMode(memorize)
        ? "首字提示"
        : isSentenceHideMode(memorize)
            ? `整句隐藏 ${Math.round(sentenceHideDifficulty(memorize) * 100)}%`
            : isCharHideMode(memorize)
                ? `单字隐藏 ${Math.round(memorize * 100)}%`
                : "";

    return (
        <>
            <Button variant="destructive" onClick={quitMemorizeMode} style={{
                backgroundColor: 'var(--theme-color)'
            }} className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">结束背诵</span>
                {modeName && <span className="text-xs opacity-80 hidden sm:inline">{modeName}</span>}
            </Button>
        </>
    )
}
