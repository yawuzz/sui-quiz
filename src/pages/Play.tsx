import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";

export default function Play() {
  const { roomCode = "" } = useParams();
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();

  const initialName = useMemo(() => sp.get("name") || "", [sp]);
  const [name, setName] = useState(initialName);
  const [joined, setJoined] = useState(!!initialName);
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState<null | {
    index: number; text: string; options: string[]; points: number; endsAt: number;
  }>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<null | {
    index: number; correctIndex: number; leaderboard: Array<{id:string;name:string;score:number}>; nextAt?: number;
  }>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", room: roomCode }));
      if (initialName) {
        ws.send(JSON.stringify({ type: "join", room: roomCode, name: initialName }));
      }
    });

    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "state" && msg.room === roomCode) {
          setStarted(!!msg.started);
        }
        if (msg.type === "question" && msg.room === roomCode) {
          setResults(null);
          setPicked(null);
          setCurrentQ({
            index: msg.index,
            text: msg.text,
            options: msg.options,
            points: msg.points,
            endsAt: msg.endsAt
          });
        }
        if (msg.type === "results" && msg.room === roomCode) {
          setResults({ index: msg.index, correctIndex: msg.correctIndex, leaderboard: msg.leaderboard, nextAt: msg.nextAt });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  useEffect(() => {
    if (name && sp.get("name") !== name) {
      const next = new URLSearchParams(sp);
      next.set("name", name);
      setSp(next, { replace: true });
    }
  }, [name, sp, setSp]);

  function doJoin() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName(trimmed);
    setJoined(true);
    wsRef.current?.send(JSON.stringify({ type: "join", room: roomCode, name: trimmed }));
  }

  function leave() {
    wsRef.current?.send(JSON.stringify({ type: "leave", room: roomCode }));
    setJoined(false);
    setName("");
    const next = new URLSearchParams(sp);
    next.delete("name");
    setSp(next, { replace: true });
    navigate(`/play/${roomCode}`);
  }

  function pick(i: number) {
    if (!currentQ) return;
    if (picked !== null) return;
    setPicked(i);
    wsRef.current?.send(JSON.stringify({ type: "answer", room: roomCode, index: currentQ.index, choice: i }));
  }

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
      <div className="max-w-xl mx-auto">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-center">Join Quiz — Room {roomCode}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!joined ? (
              <>
                <label className="text-sm font-medium text-foreground block">Your Name</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Alice"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background/50 border-border"
                  />
                  <Button disabled={!name.trim()} onClick={doJoin}>Join</Button>
                </div>
              </>
            ) : (
              <>
                {!currentQ && !results && (
                  <p className="text-sm text-muted-foreground">
                    Welcome, <b>{name}</b> — {started ? "waiting for next question…" : "waiting for host to start…"}
                  </p>
                )}

                {currentQ && (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">Time left: {remainSecQ}s • {currentQ.points} pts</div>
                    <div className="font-medium">{currentQ.text}</div>
                    <div className="grid grid-cols-1 gap-2">
                      {currentQ.options.map((o, i) => (
                        <button
                          key={i}
                          onClick={() => pick(i)}
                          disabled={picked !== null}
                          className={`text-left p-3 rounded border ${
                            picked === i ? "bg-primary/20 border-primary" : "bg-background/40 border-border"
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                    {picked !== null && <div className="text-xs text-muted-foreground">Answer locked.</div>}
                  </div>
                )}

                {results && (
                  <div className="space-y-3">
                    <div className="font-medium">
                      {results.index >= 0 ? `Results — Q${results.index + 1}` : "Final Leaderboard"}
                      {results.index >= 0 && results.nextAt ? ` • Next in ${remainSecNext}s` : ""}
                    </div>
                    {results.index >= 0 && (
                      <div className="text-xs text-muted-foreground">Correct: option #{results.correctIndex + 1}</div>
                    )}
                    <div className="space-y-2">
                      {results.leaderboard.map((p, idx) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded border border-border bg-background/40">
                          <span>{idx + 1}. {p.name}</span>
                          <span className="text-xs">{p.score} pts</span>
                        </div>
                      ))}
                    </div>

                    {results.index < 0 && (
                      <div className="flex gap-2 pt-2">
                        <Button onClick={() => navigate("/")}>Home</Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={leave}>Leave</Button>
                  <Button variant="outline" onClick={() => navigate("/")}>Home</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
