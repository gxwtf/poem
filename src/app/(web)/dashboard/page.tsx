// 主页推荐页面

import { SiteHeader } from "@/components/site-header"
import Recommends from "@/components/recommends"
import { CheckIn } from "@/components/check-in"
import { TodayInHistory } from "@/components/today-in-history"
import { PerfectDictation } from "@/components/perfect-dictation"
import React from "react"

export default function Page() {
    return (
        <>
            <SiteHeader />
            <div className="flex flex-1 flex-col gap-4 p-2 sm:p-4 md:p-6">
                <div className="grid auto-rows-min gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <CheckIn />
                    {/* <CarouselPlugin /> */}
                    <PerfectDictation />
                    <TodayInHistory />
                </div>
                <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
                    <Recommends />
                </div>
            </div>
        </>
    )
}