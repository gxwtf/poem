"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import styles from "@/components/leaderboard-quiz.module.css"
import {
    LEADERBOARD_ANONYMOUS_NAME,
    LEADERBOARD_LABELS,
    LEADERBOARD_TYPES,
    type LeaderboardResponse,
    type LeaderboardType,
} from "@/lib/perfect-dictation"

/**
 * 完胜默写打卡榜。样式完全照抄广学题库的答题榜（leaderboard.css + leaderboard.js 的 DOM），
 * 只把「一个比赛的榜」换成两个口径的榜：勤学榜（连续）/ 积跬榜（累计）。
 */

const MEDAL_STYLES = [styles.medalGold, styles.medalSliver, styles.medalBronze]
const CARD_STYLES = [styles.cardGold, styles.cardSliver, styles.cardBronze]
const MEDAL_EMOJIS = ["🥇", "🥈", "🥉"]

type BoardState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; data: LeaderboardResponse }

export default function PerfectDictationLeaderboard() {
    const [boards, setBoards] = useState<Record<LeaderboardType, BoardState>>({
        streak: { status: "loading" },
        total: { status: "loading" },
    })
    const [reloadKey, setReloadKey] = useState(0)
    const abortRef = useRef<AbortController | null>(null)

    const load = useCallback(async () => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        setBoards({ streak: { status: "loading" }, total: { status: "loading" } })

        await Promise.all(
            LEADERBOARD_TYPES.map(async (type) => {
                try {
                    const response = await fetch(
                        `/api/perfect-dictation/leaderboard?type=${type}`,
                        { signal: controller.signal, cache: "no-store" }
                    )
                    if (!response.ok) throw new Error("加载失败")
                    const data = (await response.json()) as LeaderboardResponse
                    if (controller.signal.aborted) return
                    setBoards((previous) => ({ ...previous, [type]: { status: "ready", data } }))
                } catch {
                    if (controller.signal.aborted) return
                    setBoards((previous) => ({ ...previous, [type]: { status: "error" } }))
                }
            })
        )
    }, [])

    useEffect(() => {
        void load()
        return () => abortRef.current?.abort()
    }, [load, reloadKey])

    return (
        <div className={styles.wrapper}>
            <h1 className={styles.title}>排行榜</h1>
            {LEADERBOARD_TYPES.map((type) => (
                <section key={type}>
                    <h2 className={styles.subTitle}>{LEADERBOARD_LABELS[type]}</h2>
                    <ul className={styles.leaderboard}>
                        {boards[type].status === "loading" && (
                            <li className={styles.summaryText}>加载中…</li>
                        )}
                        {boards[type].status === "error" && (
                            <li>
                                <button
                                    type="button"
                                    className={styles.error}
                                    onClick={() => setReloadKey((value) => value + 1)}
                                >
                                    加载失败，点击重试
                                </button>
                            </li>
                        )}
                        {boards[type].status === "ready" && (
                            <BoardRows data={boards[type].data} />
                        )}
                    </ul>
                </section>
            ))}
        </div>
    )
}

function BoardRows({ data }: { data: LeaderboardResponse }) {
    const { rank, me, totalParticipants, unit } = data
    const meInRank = rank.some((entry) => entry.isMe)

    if (rank.length === 0) {
        return <li className={styles.summaryText}>还没有人打卡，快去完成第一组吧。</li>
    }

    return (
        <>
            {me && !meInRank && (
                <li className={`${styles.playerCard} ${styles.myRanking}`}>
                    <div className={styles.rankBadge}>{me.rank}</div>
                    <div className={styles.playerInfo}>
                        <span className={styles.playerName}>我的排名 | 我</span>
                        <span className={styles.playerScore}>
                            {me.score} {unit}
                        </span>
                    </div>
                </li>
            )}

            {rank.map((entry, index) => {
                const medal = index < 3 ? MEDAL_STYLES[index] : null
                const cardStyle = index < 3 ? CARD_STYLES[index] : null
                return (
                    <li
                        key={entry.userId}
                        className={[
                            styles.playerCard,
                            cardStyle ?? "",
                            entry.isMe ? styles.playerCardHighlight : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        <div className={styles.rankBadge}>{index + 1}</div>
                        <div className={styles.playerInfo}>
                            <span className={styles.playerName}>
                                {entry.name || LEADERBOARD_ANONYMOUS_NAME}
                            </span>
                            <span className={styles.playerScore}>
                                {entry.score} {unit}
                            </span>
                        </div>
                        <div className={`${styles.medal} ${medal ?? ""}`}>
                            {medal ? MEDAL_EMOJIS[index] : ""}
                        </div>
                    </li>
                )
            })}

            {me && (
                <>
                    <li className={styles.summaryText}>排名：{me.rank}</li>
                    <li className={styles.summaryText}>
                        超过了{" "}
                        {((1 - (me.rank - 1) / Math.max(1, totalParticipants)) * 100).toFixed(2)}%
                        的参与者
                    </li>
                </>
            )}
        </>
    )
}
