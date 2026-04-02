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
import { CircleQuestionMark, Brain } from "lucide-react";
import { MemorizeContext } from "./memorize-context";

export function Memorize() {
    const { memorize, setMemorize } = useContext(MemorizeContext);
    const [difficulty, setDifficulty] = useState(0.5);

    function enterMemorizeMode() {
        console.log('enterMemorizeMode');
        setMemorize(difficulty);
    }

    function quitMemorizeMode() {
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
                    <PopoverContent>
                        <h4 className="bold">背诵古诗文</h4>
                        <div className="grid grid-cols-2 gap-x-1 gap-y-3">
                            <Label htmlFor="difficulty">
                                <Popover>
                                    <PopoverTrigger className="flex items-center gap-1">
                                        背诵难度<CircleQuestionMark className="w-4 h-4" />
                                    </PopoverTrigger>
                                    <PopoverContent>
                                        <p>
                                            背诵难度是一个(0,1]之间的实数，表示原文中每个字隐藏的概率。该值越大，难度越高。
                                        </p>
                                    </PopoverContent>
                                </Popover>
                            </Label>
                            <Input type="number" id="difficulty" min="0" max="1" defaultValue={isNaN(difficulty) ? '' : difficulty} onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setDifficulty(parseFloat(e.target.value))
                            }} />
                            <Button onClick={enterMemorizeMode} className="flex items-center gap-2">
                                <Brain className="w-4 h-4" />
                                开始背诵
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </>
        );
    }

    return (
        <>
            <Button variant="destructive" onClick={quitMemorizeMode} style={{
                backgroundColor: 'var(--theme-color)'
            }} className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">结束背诵</span>
            </Button>
        </>
    )
}