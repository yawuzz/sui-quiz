// src/Pages/Room.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WS_URL } from "../config";

type Player = { id: string; name: string; score: number };

export default function Room() {
  const { roomCode = "" } = useParams();
  const ROOM = (roomCode || "").trim().toUpperCase(); // <— önemli
  const { state } = useLocation() as { state?: { questions?: any[] } };
  const navigate = useNavigate();

  const [players, setPlayers] = useState<Player[]>([]);
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState<any>(null);
  const [results, setResults] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const joinUrl = useMemo(() => `${window.location.origin}/play/${ROOM}`, [ROOM]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    console.log("[ROOM] WS connect →", WS_URL, "room:", ROOM);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", room: ROOM }));
      if (state?.questions?.length) {
        ws.send(JSON.stringify({ type: "load_questions", room: ROOM, questions: state.questions }));
      }
    });

    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (!msg || msg.room !== ROOM) return;

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
            leaderboard: msg.leaderboard || [],
            nextAt: msg.nextAt,
          });
          setCurrentQ(null);
          return;
        }
        if (msg.type === "final") {
          setResults({ index: -1, correctIndex: -1, leaderboard: msg.leaderboard || [] });
          setCurrentQ(null);
          setStarted(false);
          return;
        }
      } catch {}
    });

    ws.addEventListener("error", (e) => console.error("[ROOM] WS error", e));
    ws.addEventListener("close", (e) => console.warn("[ROOM] WS close", e?.code, e?.reason));

    return () => { try { ws.close(); } catch {} };
  }, [ROOM, state?.questions]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(joinUrl); alert("Join link copied!"); }
    catch { alert("Copy failed. Link: " + joinUrl); }
  };
  const openPlayerView = () => window.open(joinUrl, "_blank");
  const startGame = () => wsRef.current?.send(JSON.stringify({ type: "start", room: ROOM }));
  const endGame   = () => wsRef.current?.send(JSON.stringify({ type: "end",   room: ROOM }));

  // (UI senin mevcut sürümünle aynı kalabilir)
  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader><CardTitle className="text-center">Scan to Join — Room {ROOM}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-white p-4 rounded-md flex justify-center">
              <QRCode value={joinUrl} size={240} />
            </div>
            <p className="text-xs text-muted-foreground break-all text-center">{joinUrl}</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={copyLink}>Copy Link</Button>
              <Button className="flex-1" onClick={openPlayerView}>Open Player View</Button>
              <Button variant="outline" onClick={() => navigate("/")}>Home</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader><CardTitle>Players ({players.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {players.length === 0 && <p className="text-muted-foreground">Waiting for players…</p>}
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-background/30 rounded-lg border border-border/30">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs">{p.score} pts</span>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button disabled={started || players.length === 0} onClick={startGame}>Start Game</Button>
              <Button variant="outline" disabled={!started && !results} onClick={endGame}>End Game</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
