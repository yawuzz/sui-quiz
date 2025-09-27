import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WS_URL } from "../config";

type Player = { id: string; name: string; score?: number };
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
  const ROOM = (roomCode || "").trim().toUpperCase(); // <— KRİTİK
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

  // QR için katılım linki
  const joinUrl = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/play/${ROOM}`;
  }, [ROOM]);

  useEffect(() => {
    if (!ROOM) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    console.log("[ROOM] WS connect →", WS_URL, "room:", ROOM);

    ws.addEventListener("open", () => {
      console.log("[ROOM] WS open → subscribe", ROOM);
      ws.send(JSON.stringify({ type: "subscribe", room: ROOM }));

      // Quiz verisi dashboard’tan geldiyse yükle
      if (state?.questions?.length) {
        console.log("[ROOM] load_questions →", state.questions.length);
        ws.send(JSON.stringify({ type: "load_questions", room: ROOM, questions: state.questions }));
      }
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string);
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
      } catch (e) {
        console.warn("[ROOM] WS parse error:", e);
      }
    });

    ws.addEventListener("error", (e) => {
      console.error("[ROOM] WS error", e);
      alert("WS error (room). DevTools’a bak.");
    });
    ws.addEventListener("close", (e: CloseEvent) => {
      console.warn("[ROOM] WS close", e.code, e.reason);
    });

    return () => { try { ws.close(); } catch {} };
  }, [ROOM, state?.questions]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(joinUrl); alert("Join link copied!"); }
    catch { alert("Copy failed. Link: " + joinUrl); }
  };
  const openPlayerView = () => window.open(joinUrl, "_blank");
  const startGame = () => wsRef.current?.send(JSON.stringify({ type: "start", room: ROOM }));
  const endGame   = () => wsRef.current?.send(JSON.stringify({ type: "end",   room: ROOM }));

  // geri sayım
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const remainSecQ    = currentQ ? Math.max(0, Math.ceil((currentQ.endsAt - now) / 1000)) : 0;
  const remainSecNext = results?.nextAt ? Math.max(0, Math.ceil((results.nextAt - now) / 1000)) : 0;

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6">
        {/* QR + link */}
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

        {/* Players / Controls */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader><CardTitle>Players ({players.length})</CardTitle></CardHeader>
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

      {/* Host view: soru */}
      {currentQ && (
        <div className="max-w-6xl mx-auto mt-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader><CardTitle>Q{currentQ.index + 1} — {currentQ.points} pts — {remainSecQ}s left</CardTitle></CardHeader>
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

      {/* Sonuçlar / leaderboard */}
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
