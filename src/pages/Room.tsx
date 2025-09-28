// src/pages/Room.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import QRCode from "react-qr-code";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { WS_URL, BASE_URL } from "../config";

type Player = {
  id: string;
  name: string;
  score?: number;
  address?: string | null; // <- WS sunucusundaki alan "address"
};

type Question = {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  points: number;
  durationSec: number;
};

export default function Room() {
  const { roomCode = "" } = useParams();
  const ROOM = (roomCode || "").trim().toUpperCase();
  const { state } = useLocation() as { state?: { questions?: Question[] } };
  const navigate = useNavigate();

  // Host wallet
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [players, setPlayers] = useState<Player[]>([]);
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState<null | {
    index: number;
    text: string;
    options: string[];
    points: number;
    endsAt: number;
  }>(null);
  const [results, setResults] = useState<null | {
    index: number;
    correctIndex: number;
    leaderboard: Player[];
    nextAt?: number;
  }>(null);

  // Prize pool (SUI)
  const [prizeSui, setPrizeSui] = useState<number>(1);

  const wsRef = useRef<WebSocket | null>(null);
  const joinUrl = useMemo(() => `${BASE_URL}/play/${ROOM}`, [ROOM]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", room: ROOM }));
      if (state?.questions?.length) {
        ws.send(
          JSON.stringify({
            type: "load_questions",
            room: ROOM,
            questions: state.questions,
          }),
        );
      }
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.room !== ROOM) return;

        if (msg.type === "state") {
          setPlayers(msg.players || []);
          setStarted(!!msg.started);
          return;
        }
        if (msg.type === "question") {
          setResults(null);
          setCurrentQ({
            index: msg.index,
            text: msg.text,
            options: msg.options,
            points: msg.points,
            endsAt: msg.endsAt,
          });
          return;
        }
        if (msg.type === "results") {
          setResults({
            index: msg.index,
            correctIndex: msg.correctIndex,
            leaderboard: msg.leaderboard,
            nextAt: msg.nextAt,
          });
          setCurrentQ(null);
          return;
        }
        if (msg.type === "final") {
          setResults({
            index: -1,
            correctIndex: -1,
            leaderboard: msg.leaderboard,
          });
          setCurrentQ(null);
          setStarted(false);
          return;
        }
      } catch {
        /* ignore */
      }
    });

    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [ROOM, state?.questions]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      alert("Join link copied!");
    } catch {
      alert("Copy failed. Link: " + joinUrl);
    }
  };
  const openPlayerView = () => window.open(joinUrl, "_blank");
  const startGame = () =>
    wsRef.current?.send(JSON.stringify({ type: "start", room: ROOM }));
  const endGame = () =>
    wsRef.current?.send(JSON.stringify({ type: "end", room: ROOM }));

  // ---------- Payout (50/30/20) — splitCoins + transferObjects ----------
  const toMist = (sui: number) => {
    const n = Number.isFinite(sui) && sui > 0 ? sui : 0;
    return BigInt(Math.floor(n * 1e9)); // SUI -> MIST
  };

  async function payoutTop3() {
    if (!account) {
      alert("Connect wallet first.");
      return;
    }
    if (!results?.leaderboard?.length) {
      alert("No results yet.");
      return;
    }

    // cüzdanı olan top3
    const sorted = [...results.leaderboard]
      .filter((p) => !!p.address)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    const w1 = sorted[0]?.address;
    const w2 = sorted[1]?.address;
    const w3 = sorted[2]?.address;

    if (!w1) {
      alert("No winners with wallet address.");
      return;
    }

    const total = toMist(prizeSui);
    const a1 = (total * 50n) / 100n;
    const a2 = w2 ? (total * 30n) / 100n : 0n;
    const a3 = w3 ? (total * 20n) / 100n : 0n;

    const tx = new Transaction();

    // amounts -> u64 pure (BigInt için tx.pure.u64 kullan)
    const outs = tx.splitCoins(tx.gas, [
      tx.pure.u64(a1),
      tx.pure.u64(a2),
      tx.pure.u64(a3),
    ]);

    // adres -> pure.address (literal tür gerektirir, helper fonksiyonu kullan)
    tx.transferObjects([outs[0]], tx.pure.address(w1 as string));
    if (w2 && a2 > 0n) tx.transferObjects([outs[1]], tx.pure.address(w2));
    if (w3 && a3 > 0n) tx.transferObjects([outs[2]], tx.pure.address(w3));

    await signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => alert("Payout sent ✅"),
        onError: (e) => alert("Payout failed: " + (e as any)?.message),
      },
    );
  }

  // countdowns
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const remainSecQ = currentQ
    ? Math.max(0, Math.ceil((currentQ.endsAt - now) / 1000))
    : 0;
  const remainSecNext = results?.nextAt
    ? Math.max(0, Math.ceil((results.nextAt - now) / 1000))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6">
        {/* QR & controls */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-center">
              Scan to Join — Room {ROOM}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-white p-4 rounded-md flex justify-center">
              <QRCode value={joinUrl} size={240} />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Room Code: <b>{ROOM}</b>
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={copyLink}>
                Copy Link
              </Button>
              <Button className="flex-1" onClick={openPlayerView}>
                Open Player View
              </Button>
              <Button variant="outline" onClick={() => navigate("/")}>
                Home
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Players / Controls */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle>Players ({players.length})</CardTitle>
            <div className="self-end">
              <ConnectButton />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {players.length === 0 && (
              <p className="text-muted-foreground">Waiting for players…</p>
            )}
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-background/30 rounded-lg border border-border/30"
              >
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.score ?? 0} pts
                </span>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                disabled={started || players.length === 0}
                onClick={startGame}
              >
                Start Game
              </Button>
              <Button
                variant="outline"
                disabled={!started && !results}
                onClick={endGame}
              >
                End Game
              </Button>
            </div>

            {/* Prize / payout */}
            <div className="mt-2 p-3 rounded border border-border/40 bg-card/30">
              <label className="text-sm text-foreground block mb-1">
                Prize Pool (SUI, testnet)
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={prizeSui}
                  onChange={(e) => setPrizeSui(Number(e.target.value))}
                  className="bg-background/50 border-border"
                />
                <Button disabled={!account} onClick={payoutTop3}>
                  Finalize & Payout (50/30/20)
                </Button>
              </div>
              {!account && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Connect wallet to send prizes.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Host current question */}
      {currentQ && (
        <div className="max-w-6xl mx-auto mt-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle>
                Q{currentQ.index + 1} — {currentQ.points} pts — {remainSecQ}s
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{currentQ.text}</p>
              <div className="grid md:grid-cols-2 gap-2">
                {currentQ.options.map((o, i) => (
                  <div
                    key={i}
                    className="p-3 rounded border border-border bg-background/40"
                  >
                    {o}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results / Leaderboard */}
      {results && (
        <div className="max-w-6xl mx-auto mt-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle>
                {results.index >= 0
                  ? `Results — Q${results.index + 1}`
                  : "Final Leaderboard"}
                {results.index >= 0 && results.nextAt
                  ? ` • Next in ${remainSecNext}s`
                  : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {results.index >= 0 && (
                <p className="text-sm text-muted-foreground">
                  Correct: option #{results.correctIndex + 1}
                </p>
              )}
              {results.leaderboard.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-background/30 rounded-lg border border-border/30"
                >
                  <span className="font-medium">
                    {idx + 1}. {p.name}
                  </span>
                  <span className="text-xs">{p.score ?? 0} pts</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
