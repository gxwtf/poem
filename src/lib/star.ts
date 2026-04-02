"use server"

import prisma from "@/lib/prisma";

export const queryStar = async (userId: number, poemId: string): Promise<boolean> => {
    const res = await prisma.star.findUnique({
        where: {
            compoundId: {
                userId: userId,
                poemId: poemId
            }
        }
    });
    if(res) return true;
    return false;
};

export const updateStar = async (userId: number, poemId: string): Promise<boolean> => {
    const type = await queryStar(userId,poemId);
    if(type){
        await prisma.star.delete({
            where: {
                compoundId: {
                    userId: userId,
                    poemId: poemId
                }
            }
        });
    }
    else{
        console.log(userId, poemId);
        await prisma.star.create({
            data: {
                userId: userId,
                poemId: poemId
            }
        })
    }
    return !type;
};

export const queryStarNum = async (poemId: string): Promise<number> => {
    const res = await prisma.star.findMany({
        where: {
            poemId: poemId
        }
    });
    return res.length;
}

export const queryPoemId = async (version: string, title: string): Promise<string> => {
    const res = await prisma.poem.findUnique({
        where: {
            compoundId: {
                version: version,
                title: title
            }
        }
    });
    if(!res) throw 'poem is not found';
    return res.id;
}

export const queryStars = async (userId: number) => {
    const res = await prisma.star.findMany({
        where: {
            userId: userId
        }
    });
    const poems = await Promise.all(res.map(async (item) => {
        return await prisma.poem.findUnique({
            where: {
                id: item.poemId
            }
        });
    }));
    return poems.map(poem => ({
        ...poem,
        content: poem?.content ? poem?.content.replace(/[#\/]/g, '') : poem?.content
    }));
}