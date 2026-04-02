// 古诗文汉字组件 
 
 "use client" 
 
 import { useState, useRef, useContext, useEffect } from "react"; 
 import CharNote from "./char-note"; 
 import { MemorizeContext } from "./memorize-context"; 
 
 export type CharData = { 
     char: string 
     pinyin?: string 
     note?: { title: string; content: string }[] 
     frequency?: number 
 } 
 
 enum CharMode{ 
     Read = 0, 
     Memorize = 1, 
     ShowAnswer = 2 
 } 
 
 export function Char({ 
     data, 
     showPinyin, 
     highlight, 
     suppressNote, 
     showNotes, 
     mouseDownStat 
 }: { 
     data: CharData 
     showPinyin: boolean 
     highlight: boolean 
     suppressNote?: (suppress: boolean) => void 
     showNotes: boolean 
     mouseDownStat: boolean 
 }) { 
     const [showNote, setShowNote] = useState(false); 
     const hoverTimer = useRef<number | null>(null); 
     const { memorize } = useContext(MemorizeContext); 
     const [ memorizeMode, setMemorizeMode ] = useState(CharMode.Read); 
 
     useEffect(() => { 
         if ("。，、；：？！“”‘’（）【】《》…—·～".includes(data.char))setMemorizeMode(CharMode.Read); 
         else if (!isNaN(memorize))setMemorizeMode(Math.random() < memorize ? CharMode.Memorize : CharMode.Read); 
         else setMemorizeMode(CharMode.Read); 
     }, [memorize, data.char]); 
 
     // useEffect(() => { 
     //     console.log('ShowNotes:', showNotes); 
     // }, [showNotes]); 
 
     if (memorizeMode !== CharMode.Memorize){ 
         const clearHoverTimer = () => { 
             if (hoverTimer.current !== null) { 
                 clearTimeout(hoverTimer.current); 
                 hoverTimer.current = null; 
             } 
         }; 
 
         const handleMouseEnter = () => { 
             if (!showNotes) return; // 新增：隐藏注释时不触发 
             clearHoverTimer(); 
             setShowNote(true); 
             suppressNote?.(true); 
         }; 
 
         const handleMouseLeave = () => { 
             if (!showNotes) return; // 新增：隐藏注释时不触发 
             clearHoverTimer(); 
             hoverTimer.current = window.setTimeout(() => { 
                 setShowNote(false); 
                 suppressNote?.(false); 
             }, 200); 
         }; 
 
         return ( 
             <div 
                 className={`inline-block justify-center ${memorizeMode === CharMode.Read ? "text-primary" : "text-[var(--theme-color)]"} ${highlight ? "bg-yellow-100" : ""} relative select-none`} 
                 onMouseEnter={handleMouseEnter} 
                 onMouseLeave={handleMouseLeave} 
             > 
                 <span className="inline-flex flex-col items-center min-w-[1.5em] cursor-pointer"> 
                     {showPinyin && ( 
                         <span className="text-base text-gray-500 leading-none">{data.pinyin || ""}</span> 
                     )} 
                     {data.note && showNotes ? (
                         <CharNote 
                             char={data.char} 
                             pinyin={data.pinyin} 
                             note={data.note} 
                             frequency={data.frequency} 
                         >
                             <strong>{data.char}</strong>
                         </CharNote>
                     ) : data.char}
                 </span> 
             </div> 
         ); 
     } 
 
     function handleMouseOver() { 
         if (mouseDownStat && memorizeMode === CharMode.Memorize) 
             setMemorizeMode(CharMode.ShowAnswer); 
     } 
 
     function handleClick() { 
         if (memorizeMode === CharMode.Memorize) 
             setMemorizeMode(CharMode.ShowAnswer); 
     } 
 
     return ( 
         <div 
             className={`inline-block justify-center text-primary ${highlight ? "bg-yellow-100" : ""} relative select-none`} 
             onMouseOver={handleMouseOver} 
             onClick={handleClick} 
         > 
             <span className="inline-flex flex-col items-center min-w-[1.5em] cursor-pointer"> 
                 {showPinyin && ( 
                     <span className="text-base text-gray-500 leading-none">{data.pinyin || ""}</span> 
                 )} 
                 <span> 
                     __ 
                 </span> 
             </span> 
 
             {showNote && data.note && ( 
                 <CharNote char={data.char} pinyin={data.pinyin} note={data.note} frequency={data.frequency} > 
                     <span>{data.char}</span> 
                 </CharNote> 
             )} 
         </div> 
     ) 
 }