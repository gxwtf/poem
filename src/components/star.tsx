"use client"

import {
    Star
} from "lucide-react";
import { useEffect, useState } from "react";
import { queryStar, updateStar, queryStarNum, queryPoemId } from "@/lib/star";
import useSession from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function StarButton({
    version,
    title
}: {
    version: string
    title: string
}){
    const { session } = useSession();
    const userId = session.userid;
    const [ starStat, setStarStat ] = useState<boolean>(false);
    const [ starNum, setStarNum ] = useState<number>(0);
    const [ poemId, setPoemId ] = useState<string>("");
    useEffect(() => {
        queryPoemId(version,title)
        .then((res)=>{setPoemId(res);});
        queryStarNum(poemId)
        .then((res)=>{setStarNum(res);});
        if(session.isLoggedIn){
            queryStar(userId,poemId)
            .then((res)=>{setStarStat(res);});
        }
    }, [userId, poemId, session, title, version]);
    return (
        <Button
            onClick={async (event) => {
                event.stopPropagation();
                if (session.isLoggedIn) {
                    setStarStat(await updateStar(userId, poemId));
                    queryStarNum(poemId).then((res) => setStarNum(res));
                }
            }}
            variant="outline"
            className="flex items-center gap-2"
        >
            <Star
                className="w-4 h-4"
                fill={starStat?"#eac54f":"none"}
                color={starStat?"#eac54f":"var(--primary)"}
            />
            <span className="hidden sm:inline text-primary">{starStat ? "已收藏" : "收藏"}</span>
            <Badge variant="secondary" className="hidden sm:inline">{starNum}</Badge>
        </Button>

    );
}
