// src/pages/Play.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WS_URL } from "../config";

type LeaderboardPlayer = { id: string; name: string; score: number };

export default function Play() {
  const { roomCode = "" } = useParams();
  const ROOM = (roomCode || "").trim().toUpperCase();

  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();

  // İlk yüklemede URL'deki ?name değerini oku (sadece 1 kez)
  const urlName = useMemo(() => sp.get("name") || "", []); // <— DİKKAT: deps yok
  const [name, setName] = useState(urlName);
  const [joined, setJoined] = useState(!!urlName);
  const [started, setStarted] = useState(false);

  const [currentQ, setCurrentQ] = useState<null | {
    index: number;
    text: string;
    options: string[];
    points: number;
    endsAt: number;
  }>(null);

  const [picked, setPicked] = useState<number | null>(null);

  const [results, setResults] = useState<null | {
    index: number;
    correctIndex: number;
    leaderboard: LeaderboardPlayer[];
    nextAt?: number;
  }>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Oda kodu yoksa WS açma
  if (!ROOM) {
    return (
      <div className="min-h-screen bg-gradient-background p-6">
        <div className="max-w-xl mx-auto">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-center">Join Quiz</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Missing room code. Use a link like <code>/play/ABC123</code>.
              </p>
              <div className="pt-3">
                <Button onClick={() => navigate("/")}>Home</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 🔌 WS sadece ROOM değişince açılır (keystroke ile açılmaz!)
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    console.log("[PLAY] WS connect →", WS_URL, "room:", ROOM);

    ws.addEventListener("open", () => {
      console.log("[PLAY] WS open → subscribe", ROOM);
      ws.send(JSON.stringify({ type: "subscribe", room: ROOM }));
      // Burada "join" GÖNDERMİYORUZ. Join, aşağıdaki ayrı effect ile (butona basınca) gidecek.
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (!msg || msg.room !== ROOM) return;

        if (msg.type === "state") {
          setStarted(!!msg.started);
          return;
        }
        if (msg.type === "question") {
          setResults(null);
          setPicked(null);
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
          setResults({
            index: -1,
            correctIndex: -1,
            leaderboard: msg.leaderboard || [],
          });
          setCurrentQ(null);
          setStarted(false);
          return;
        }
      } catch (e) {
        console.warn("[PLAY] WS parse error:", e);
      }
    });

    ws.addEventListener("error", (e) => {
      console.error("[PLAY] WS error", e);
      // alert("WS error (play). Check DevTools Console."); // Spam olmasın diye kapattım
    });

    ws.addEventListener("close", (e: CloseEvent) => {
      console.warn("[PLAY] WS close", e.code, e.reason);
    });

    return () => {
      try { ws.close(); } catch {}
    };
  }, [ROOM]);

  // ✅ Join mesajını sadece "joined === true && name" olduğunda ve WS açıkken gönder
  useEffect(() => {
    if (!joined || !name) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "join", room: ROOM, name }));
    }
  }, [joined, name, ROOM]);

  // (ÖNEMLİ) Her harfte URL'e yazmayacağız. Sadece Join/Leave anında güncelle.
  function doJoin() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName(trimmed);
    setJoined(true);

    const next = new URLSearchParams(sp);
    next.set("name", trimmed);
    setSp(next, { replace: true });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join", room: ROOM, name: trimmed }));
    }
  }

  function leave() {
    try { wsRef.current?.send(JSON.stringify({ type: "leave", room: ROOM })); } catch {}
    setJoined(false);
    setName("");
    const next = new URLSearchParams(sp);
    next.delete("name");
    setSp(next, { replace: true });
    navigate(`/play/${ROOM}`);
  }

  function pick(i: number) {
    if (!currentQ) return;
    if (picked !== null) return;
    setPicked(i);
    wsRef.current?.send(JSON.stringify({ type: "answer", room: ROOM, index: currentQ.index, choice: i }));
  }

  // geri sayım
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const remainSecQ   = currentQ ? Math.max(0, Math.ceil((currentQ.endsAt - now) / 1000)) : 0;
  const remainSecNext = results?.nextAt ? Math.max(0, Math.ceil((results.nextAt - now) / 1000)) : 0;

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-xl mx-auto">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-center">Join Quiz — Room {ROOM}</CardTitle>
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
