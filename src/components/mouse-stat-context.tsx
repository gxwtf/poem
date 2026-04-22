/**
 * 维护鼠标状态
 * 
 * author: JiZiQian
 */

import { createContext, useState } from "react";

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