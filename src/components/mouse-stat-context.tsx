/**
 * 维护鼠标状态
 * 
 * author: JiZiQian
 */

import { createContext, useEffect, useState } from "react";

export const MouseDownStatContext = createContext<boolean>(false);

export function MouseDownStatContextProvider({children}:{children: React.ReactNode}){
    const [mouseDownStat, setMouseDownStat] = useState<boolean>(false);
    const handleMouseDown = () => {
        setMouseDownStat(true);
    }
    const handleMouseUp = () => {
        setMouseDownStat(false);
    }
    return (
        <MouseDownStatContext value={mouseDownStat}>
            <div onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}>
                {children}
            </div>
        </MouseDownStatContext>
    );
}

export const MouseSelection = createContext<Selection | null>(null);

export function MouseSelectionContextProvider({children}:{children: React.ReactNode}){
    const [selection, setSelection] = useState<Selection | null>(null);
    function handleSelectionChange(){
        setSelection(window.getSelection());
    }
    useEffect(handleSelectionChange);
    function handleMouseUp(){
        handleSelectionChange();
    }
    return (
        <MouseSelection value={selection}>
            <div onMouseUp={handleMouseUp}>
                {children}
            </div>
        </MouseSelection>
    );
}