import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { WS_URL } from "../config";

type LB = { id: string; name: string; score: number };

export default function Play() {
  const { roomCode = "" } = useParams();
  const ROOM = (roomCode || "").trim().toUpperCase();

  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const account = useCurrentAccount();

  const initialName = useMemo(() => sp.get("name") || "", [sp]);
  const [name, setName] = useState(initialName);
  const [joined, setJoined] = useState(!!initialName && !!account);
  const [started, setStarted] = useState(false);

  const [currentQ, setCurrentQ] = useState<null | {
    index: number; text: string; options: string[]; points: number; endsAt: number;
  }>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<null | {
    index: number; correctIndex: number; leaderboard: LB[]; nextAt?: number;
  }>(null);

  const wsRef = useRef<WebSocket | null>(null);

  if (!ROOM) {
    return (
      <div className="min-h-screen bg-gradient-background p-6">
        <div className="max-w-xl mx-auto">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader><CardTitle className="text-center">Join Quiz</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Missing room code.</p>
              <div className="pt-3"><Button onClick={() => navigate("/")}>Home</Button></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ✅ WS sadece ROOM değişince açılır, yazdığın her harfte yeniden bağlanmaz
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", room: ROOM }));
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (!msg || msg.room !== ROOM) return;

        if (msg.type === "state") { setStarted(!!msg.started); return; }
        if (msg.type === "question") {
          setResults(null); setPicked(null);
          setCurrentQ({ index: msg.index, text: msg.text, options: msg.options, points: msg.points, endsAt: msg.endsAt });
          return;
        }
        if (msg.type === "results") {
          setResults({ index: msg.index, correctIndex: msg.correctIndex, leaderboard: msg.leaderboard || [], nextAt: msg.nextAt });
          setCurrentQ(null); return;
        }
        if (msg.type === "final") {
          setResults({ index: -1, correctIndex: -1, leaderboard: msg.leaderboard || [] });
          setCurrentQ(null); setStarted(false); return;
        }
      } catch {}
    });

    ws.addEventListener("error", () => {
      // sessiz geç
    });

    return () => { try { ws.close(); } catch {} };
  }, [ROOM]); // <-- sadece ROOM

  // ?name= senkronu (bu effect WS’i tetiklemez artık)
  useEffect(() => {
    if (name && sp.get("name") !== name) {
      const next = new URLSearchParams(sp);
      next.set("name", name);
      setSp(next, { replace: true });
    }
  }, [name, sp, setSp]);

  function doJoin() {
    const trimmed = name.trim();
    if (!trimmed || !account?.address) return; // cüzdan şart istersen böyle kalsın
    setName(trimmed);
    setJoined(true);
    wsRef.current?.send(JSON.stringify({
      type: "join",
      room: ROOM,
      name: trimmed,
      addr: account.address,  // server 'addr' ya da 'address' kabul ediyor
    }));
  }

  function pick(i: number) {
    if (!currentQ || picked !== null) return;
    setPicked(i);
    wsRef.current?.send(JSON.stringify({ type: "answer", room: ROOM, index: currentQ.index, choice: i }));
  }

  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  const remainSecQ   = currentQ ? Math.max(0, Math.ceil((currentQ.endsAt - now) / 1000)) : 0;
  const remainSecNext = results?.nextAt ? Math.max(0, Math.ceil((results.nextAt - now) / 1000)) : 0;

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-xl mx-auto">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader><CardTitle className="text-center">Join — Room {ROOM}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!account && (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Connect your wallet to join.</p>
                <div className="flex justify-center"><ConnectButton /></div>
              </div>
            )}

            {account && !joined && (
              <>
                <label className="text-sm font-medium text-foreground block">Your Name</label>
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background/50 border-border" />
                  <Button disabled={!name.trim()} onClick={doJoin}>Join</Button>
                </div>
              </>
            )}

            {account && joined && (
              <>
                {!currentQ && !results && (
                  <p className="text-sm text-muted-foreground">
                    Welcome, <b>{name}</b> — {started ? "waiting for next question…" : "waiting for host…"}
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
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
