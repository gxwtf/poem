// Iron Session Server Routes /api/session

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { defaultSession, sessionOptions } from "@/lib/iron";
import { SessionData } from "@/lib/iron";
import axios from "axios";
import prisma from "@/lib/prisma";

// login
export async function POST(request: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    const { username = "No Name", password = "123456" } = (await request.json()) as {
        username: string;
        password: string;
    };

    try {
        const res = await axios.post(`${process.env.GXACCOUNT_URL}/sso/purelogin`, {
            username,
            password,
        });

        if (res.status === 200) {
            const user = await prisma.user.findUnique({
                where: {
                    id: res.data.userId
                }
            });
            if(!user){
                await prisma.user.create({
                    data: {
                        id: res.data.userId,
                    }
                });
            }
            session.isLoggedIn = true;
            session.username = res.data.userName;
            session.userid = res.data.userId;
            session.admin = res.data.admin;
            session.real_name = res.data.userRealName;
            session.email = res.data.userEmail;
            session.grade = res.data.grade || 7;
            session.counter = 0;
            session.version = (session.grade ?? 13) >= 10 ? 'senior' : 'junior';
            await session.save();

            // 在响应头中添加版本信息，客户端可以在登录后同步到localStorage
            const response = Response.json(session);
            response.headers.set('X-Session-Version', session.version);
            return response;
        }
        else {
            // 登录失败，不保存session，直接返回默认session
            return Response.json(defaultSession, { status: 401 });
        }
    } catch (e) {
        console.error(e);
        return Response.json(defaultSession, { status: 401 });
    }
}

export async function PATCH() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    session.counter = (session.counter ?? 0) + 1;
    await session.save();

    return Response.json(session);
}

// read session
export async function GET() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn) {
        return Response.json(defaultSession);
    }

    return Response.json(session);
}

// logout
export async function DELETE() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    session.destroy();

    return Response.json(defaultSession);
}
