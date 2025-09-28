import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WS_URL, BASE_URL } from "../config";

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
  const ROOM = (roomCode || "").trim().toUpperCase();
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

  // ÖNEMLİ: URL'i her zaman bulunduğun domain’den üret (Vercel).
  const joinUrl = useMemo(() => `${BASE_URL}/play/${ROOM}`, [ROOM]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", room: ROOM }));
      if (state?.questions?.length) {
        ws.send(JSON.stringify({ type: "load_questions", room: ROOM, questions: state.questions }));
      }
    });

    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.room !== ROOM) return;

        if (msg.type === "state") {
          setPlayers(msg.players || []);
          setStarted(!!msg.started);
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
        }
        if (msg.type === "results") {
          setResults({
            index: msg.index,
            correctIndex: msg.correctIndex,
            leaderboard: msg.leaderboard,
            nextAt: msg.nextAt
          });
          setCurrentQ(null);
        }
        if (msg.type === "final") {
          setResults({ index: -1, correctIndex: -1, leaderboard: msg.leaderboard });
          setCurrentQ(null);
          setStarted(false);
        }
      } catch {}
    });

    return () => { ws.close(); };
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
  const startGame = () => wsRef.current?.send(JSON.stringify({ type: "start", room: ROOM }));
  const endGame   = () => wsRef.current?.send(JSON.stringify({ type: "end",   room: ROOM }));

  // küçük geri sayım
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  const remainSecQ   = currentQ ? Math.max(0, Math.ceil((currentQ.endsAt - now) / 1000)) : 0;
  const remainSecNext = results?.nextAt ? Math.max(0, Math.ceil((results.nextAt - now) / 1000)) : 0;

  return (
    <div className="min-h-screen bg-gradient-background p-6">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6">
        {/* LEFT: QR + Controls */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-center text-foreground">
              Scan to Join — Room <span className="text-primary font-mono">{ROOM}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white p-4 rounded-lg flex justify-center shadow">
              <QRCode value={joinUrl} size={240} />
            </div>
            {/* Sadece oda kodunu göster, domain yazma */}
            <p className="text-center text-sm text-muted-foreground">
              Room Code: <b className="tracking-wider">{ROOM}</b>
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={copyLink}>Copy Link</Button>
              <Button className="flex-1" onClick={openPlayerView}>Open Player View</Button>
              <Button variant="outline" onClick={() => navigate("/")}>Home</Button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button disabled={started || players.length === 0} onClick={startGame}>Start Game</Button>
              <Button variant="outline" disabled={!started && !results} onClick={endGame}>End Game</Button>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Players */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground">Players ({players.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.length === 0 && (
              <p className="text-muted-foreground">Waiting for players…</p>
            )}
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-background/40 rounded-lg border border-border/40"
              >
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.score ?? 0} pts</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* CURRENT QUESTION (Host view) */}
      {currentQ && (
        <div className="max-w-6xl mx-auto mt-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground">
                Q{currentQ.index + 1} — {currentQ.points} pts — {remainSecQ}s
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-foreground">{currentQ.text}</p>
              <div className="grid md:grid-cols-2 gap-2">
                {currentQ.options.map((o, i) => (
                  <div
                    key={i}
                    className="p-3 rounded border border-border bg-background/40 text-foreground"
                  >
                    {o}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* RESULTS */}
      {results && (
        <div className="max-w-6xl mx-auto mt-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground">
                {results.index >= 0 ? `Results — Q${results.index + 1}` : "Final Leaderboard"}
                {results.index >= 0 && results.nextAt ? ` • Next in ${remainSecNext}s` : ""}
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
                  className="flex items-center justify-between p-3 bg-background/40 rounded-lg border border-border/40"
                >
                  <span className="font-medium text-foreground">
                    {idx + 1}. {p.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.score ?? 0} pts</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
