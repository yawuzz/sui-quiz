import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Player = { id: string; name: string; score?: number };

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";
const BASE_URL = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;

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
  const { state } = useLocation() as { state?: { questions?: Question[] } };
  const navigate = useNavigate();

  const [players, setPlayers] = useState<Player[]>([]);
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState<null | {
    index: number; text: string; options: string[]; points: number; endsAt: number;
  }>(null);
  const [results, setResults] = useState<null | {
    index: number; correctIndex: number; leaderboard: Player[]; nextAt?: number;
  }>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const joinUrl = useMemo(() => `${BASE_URL}/play/${roomCode}`, [roomCode]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", room: roomCode }));
      if (state?.questions?.length) {
        ws.send(JSON.stringify({ type: "load_questions", room: roomCode, questions: state.questions }));
      }
    });

    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "state" && msg.room === roomCode) {
          setPlayers(msg.players || []);
          setStarted(!!msg.started);
        }
        if (msg.type === "question" && msg.room === roomCode) {
          setResults(null);
          setCurrentQ({
            index: msg.index,
            text: msg.text,
            options: msg.options,
            points: msg.points,
            endsAt: msg.endsAt,
          });
        }
        if (msg.type === "results" && msg.room === roomCode) {
          setResults({
            index: msg.index,
            correctIndex: msg.correctIndex,
            leaderboard: msg.leaderboard,
            nextAt: msg.nextAt
          });
          setCurrentQ(null);
        }
        if (msg.type === "final" && msg.room === roomCode) {
          setResults({ index: -1, correctIndex: -1, leaderboard: msg.leaderboard });
          setCurrentQ(null);
          setStarted(false);
        }
      } catch {}
    });

    return () => { ws.close(); };
  }, [roomCode, state?.questions]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(joinUrl); alert("Join link copied!"); }
    catch { alert("Copy failed. Link: " + joinUrl); }
  };
  const openPlayerView = () => window.open(joinUrl, "_blank");
  const startGame = () => wsRef.current?.send(JSON.stringify({ type: "start", room: roomCode }));
  const endGame = () => wsRef.current?.send(JSON.stringify({ type: "end", room: roomCode }));

  // countdowns
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const remainSecQ = currentQ ? Math.max(0, Math.ceil((currentQ.endsAt - now) / 1000)) : 0;
  const remainSecNext = results?.nextAt ? Math.max(0, Math.ceil((results.nextAt - now) / 1000)) : 0;

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6">
        {/* QR + link */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-center">Scan to Join — Room {roomCode}</CardTitle>
          </CardHeader>
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

        {/* Players / Controls */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle>Players ({players.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {players.length === 0 && <p className="text-muted-foreground">Waiting for players…</p>}
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-background/30 rounded-lg border border-border/30">
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.score ?? 0} pts</span>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button disabled={started || players.length === 0} onClick={startGame}>Start Game</Button>
              <Button variant="outline" disabled={!started && !results} onClick={endGame}>End Game</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Question (host view) */}
      {currentQ && (
        <div className="max-w-6xl mx-auto mt-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle>
                Q{currentQ.index + 1} — {currentQ.points} pts — {remainSecQ}s left
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{currentQ.text}</p>
              <div className="grid md:grid-cols-2 gap-2">
                {currentQ.options.map((o, i) => (
                  <div key={i} className="p-3 rounded border border-border bg-background/40">{o}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results / Leaderboard (auto next in 5s) */}
      {results && (
        <div className="max-w-6xl mx-auto mt-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle>
                {results.index >= 0 ? `Results — Q${results.index + 1}` : "Final Leaderboard"}
                {results.index >= 0 && results.nextAt ? ` • Next in ${remainSecNext}s` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.index >= 0 && (
                <p className="text-sm text-muted-foreground">Correct: option #{results.correctIndex + 1}</p>
              )}
              <div className="space-y-2">
                {results.leaderboard.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-background/30 rounded-lg border border-border/30">
                    <span className="font-medium">{idx + 1}. {p.name}</span>
                    <span className="text-xs">{p.score ?? 0} pts</span>
                  </div>
                ))}
              </div>

              {results.index < 0 && (
                <div className="flex gap-2">
                  <Button onClick={() => navigate("/")}>Home</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
