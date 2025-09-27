import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_URL =
  (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:4000";
export const socket = io(API_URL, { transports: ["websocket"] });

export type Phase = "lobby" | "question" | "review" | "ended";
export type PrizeMode = "SBT" | "COIN" | "BOTH";
export type Player = { id: string; name: string; score?: number };

export function usePlayer(roomCode: string, name: string) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [q, setQ] = useState<{
    id?: string;
    index: number;
    text: string;
    options: string[];
    correctIndex?: number;
    endAt?: number;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const onQuestion = (p: any) => {
      setPhase("question");
      setQ(p);
    };
    const onReview = (p: any) => {
      setPhase("review");
      setQ((c) => (c ? { ...c, correctIndex: p.correctIndex } : c));
      setLeaderboard((p.leaderboard || []) as Player[]);
    };
    const onEnded = (p: any) => {
      setPhase("ended");
      setLeaderboard((p.leaderboard || []) as Player[]);
    };

    socket.on("room:question", onQuestion);
    socket.on("room:review", onReview);
    socket.on("room:ended", onEnded);

    timer = setInterval(() => {
      const endAt = q?.endAt ?? 0;
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setTimeLeft(left);
    }, 200);

    return () => {
      socket.off("room:question", onQuestion);
      socket.off("room:review", onReview);
      socket.off("room:ended", onEnded);
      if (timer) clearInterval(timer);
    };
  }, [q?.endAt]);

  const join = useCallback(async () => {
    socket.emit("player:join", { roomCode, name });
  }, [roomCode, name]);

  const answer = useCallback(
    async (_questionId: string, answerIndex: number) => {
      // _questionId şu an socket'te kullanılmıyor; backend REST ekleyince kullanacağız.
      socket.emit("player:answer", { roomCode, answerIndex });
    },
    [roomCode]
  );

  return { phase, q, leaderboard, timeLeft, join, answer };
}
