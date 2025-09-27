// ws-server.cjs
// Node 22 + ws
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3001;
const wss = new WebSocketServer({ port: PORT });

console.log(`WS server on ws://localhost:${PORT}`);

// === Helpers ===
function norm(code) {
  return String(code || "").trim().toUpperCase();
}
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function send(ws, obj) {
  if (ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {}
  }
}
function broadcast(room, obj) {
  const R = norm(room);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN && norm(client.room) === R) {
      send(client, obj);
    }
  }
}

// === Room state ===
/*
rooms = {
  ABC123: {
    started: false,
    players: Map<playerId, { id, name, score }>
    questions: Question[],
    currentIndex: number,
    current: {
      endsAt: number,
      answers: Map<playerId, { choice, timeMs }>
      timer: NodeJS.Timeout | null
    }
  }
}
Question = { id, text, options[], correctIndex, points, durationSec }
*/
const rooms = new Map();

function ensureRoom(room) {
  const R = norm(room);
  if (!rooms.has(R)) {
    rooms.set(R, {
      started: false,
      players: new Map(),
      questions: [],
      currentIndex: -1,
      current: null,
    });
  }
  return rooms.get(R);
}

function getRoom(room) {
  return rooms.get(norm(room));
}

function sendState(room) {
  const R = norm(room);
  const data = rooms.get(R);
  if (!data) return;
  const players = Array.from(data.players.values());
  broadcast(R, { type: "state", room: R, started: !!data.started, players });
}

function scheduleResults(room) {
  const R = norm(room);
  const data = getRoom(R);
  if (!data || !data.current) return;

  // Sonuçları hesapla
  const q = data.questions[data.currentIndex];
  const correct = q.correctIndex;

  // Skorlandırma: yanlış = 0; doğru = q.points
  // (Daha sonra süre bonusu eklenebilir)
  for (const [pid, ans] of data.current.answers.entries()) {
    const player = data.players.get(pid);
    if (!player) continue;
    if (ans.choice === correct) {
      player.score = (player.score || 0) + q.points;
    }
  }

  // Liderlik tablosu
  const leaderboard = Array.from(data.players.values())
    .map((p) => ({ id: p.id, name: p.name, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score);

  const nextAt = Date.now() + 5000; // 5 saniye sonra bir sonraki soru

  broadcast(R, {
    type: "results",
    room: R,
    index: data.currentIndex,
    correctIndex: correct,
    leaderboard,
    nextAt,
  });

  // 5sn sonra sıradaki soruya geç
  if (data.current.timer) clearTimeout(data.current.timer);
  data.current.timer = setTimeout(() => {
    data.current = null;
    nextQuestion(R);
  }, 5000);
}

function allAnswered(room) {
  const R = norm(room);
  const data = getRoom(R);
  if (!data || !data.current) return false;
  const total = data.players.size;
  const answered = data.current.answers.size;
  // En az 1 oyuncu varsa ve tümü yanıtladıysa true
  return total > 0 && answered >= total;
}

function nextQuestion(room) {
  const R = norm(room);
  const data = getRoom(R);
  if (!data) return;

  // Sıradaki index
  const nextIndex = (data.currentIndex ?? -1) + 1;
  if (!data.questions || nextIndex >= data.questions.length) {
    // Final
    const leaderboard = Array.from(data.players.values())
      .map((p) => ({ id: p.id, name: p.name, score: p.score || 0 }))
      .sort((a, b) => b.score - a.score);

    broadcast(R, { type: "final", room: R, leaderboard });
    data.started = false;
    data.currentIndex = -1;
    data.current = null;
    return;
  }

  data.currentIndex = nextIndex;
  const q = data.questions[nextIndex];
  const endsAt = Date.now() + (q.durationSec * 1000 || 20000);

  data.current = {
    endsAt,
    answers: new Map(),
    timer: null,
  };

  broadcast(R, {
    type: "question",
    room: R,
    index: nextIndex,
    text: q.text,
    options: q.options,
    points: q.points,
    endsAt,
  });

  // Süre sonunda otomatik sonuç
  data.current.timer = setTimeout(() => {
    scheduleResults(R);
  }, Math.max(0, endsAt - Date.now()));
}

function endGame(room) {
  const R = norm(room);
  const data = getRoom(R);
  if (!data) return;

  if (data.current?.timer) clearTimeout(data.current.timer);
  data.current = null;
  data.started = false;

  const leaderboard = Array.from(data.players.values())
    .map((p) => ({ id: p.id, name: p.name, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score);
  broadcast(R, { type: "final", room: R, leaderboard });
}

// === WS events ===
wss.on("connection", (ws, req) => {
  ws.id = uid();
  ws.room = null;
  ws.playerId = null;

  // Basit ping/pong keepalive
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  console.log("[WS] connection", { id: ws.id, ip: req.socket.remoteAddress });

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }
    const t = msg?.type;

    if (t === "subscribe") {
      const R = norm(msg.room);
      ws.room = R;
      ensureRoom(R);
      console.log("[WS] subscribe", { id: ws.id, room: R });
      sendState(R);
      return;
    }

    if (t === "join") {
      const R = norm(msg.room ?? ws.room);
      const name = String(msg.name || "").trim();
      if (!R || !name) return;
      ensureRoom(R);
      ws.room = R;
      if (!ws.playerId) ws.playerId = uid();

      const data = getRoom(R);
      // Aynı isimle birden fazla girişe izin veriyoruz; id bazlı tutuyoruz
      data.players.set(ws.playerId, { id: ws.playerId, name, score: data.players.get(ws.playerId)?.score || 0 });
      console.log("[WS] join", { room: R, name, playerId: ws.playerId });
      sendState(R);
      return;
    }

    if (t === "leave") {
      const R = norm(msg.room ?? ws.room);
      const data = getRoom(R);
      if (data && ws.playerId) {
        data.players.delete(ws.playerId);
      }
      console.log("[WS] leave", { room: R, playerId: ws.playerId });
      sendState(R);
      return;
    }

    if (t === "load_questions") {
      const R = norm(msg.room ?? ws.room);
      const qs = Array.isArray(msg.questions) ? msg.questions : [];
      const data = ensureRoom(R);
      data.questions = qs.map((q) => ({
        id: String(q.id || uid()),
        text: String(q.text || ""),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correctIndex: Number.isFinite(q.correctIndex) ? q.correctIndex : 0,
        points: Number.isFinite(q.points) ? q.points : 100,
        durationSec: Number.isFinite(q.durationSec) ? q.durationSec : 20,
      }));
      console.log("[WS] load_questions", { room: R, count: data.questions.length });
      sendState(R);
      return;
    }

    if (t === "start") {
      const R = norm(msg.room ?? ws.room);
      const data = ensureRoom(R);
      if (!data.questions || data.questions.length === 0) {
        console.log("[WS] start ignored (no questions)", { room: R });
        return;
      }
      data.started = true;
      data.currentIndex = -1;
      // Sıfırla skorlar (istenirse)
      for (const p of data.players.values()) {
        p.score = 0;
      }
      console.log("[WS] start", { room: R, players: data.players.size });
      sendState(R);
      nextQuestion(R);
      return;
    }

    if (t === "answer") {
      const R = norm(msg.room ?? ws.room);
      const data = getRoom(R);
      if (!data || !data.started || !data.current) return;
      if (!ws.playerId) return;

      const idx = Number(msg.index);
      const choice = Number(msg.choice);
      if (!Number.isFinite(idx) || idx !== data.currentIndex) return;
      if (!Number.isFinite(choice)) return;

      if (!data.current.answers.has(ws.playerId)) {
        data.current.answers.set(ws.playerId, { choice, timeMs: Date.now() });
        // Herkes yanıtladıysa anında sonuç
        if (allAnswered(R)) {
          // Süre timer'ı varsa iptal et
          if (data.current.timer) clearTimeout(data.current.timer);
          scheduleResults(R);
        }
      }
      return;
    }

    if (t === "end") {
      const R = norm(msg.room ?? ws.room);
      console.log("[WS] end", { room: R });
      endGame(R);
      return;
    }
  });

  ws.on("close", () => {
    const R = norm(ws.room);
    const data = getRoom(R);
    if (data && ws.playerId) {
      data.players.delete(ws.playerId);
      sendState(R);
    }
    console.log("[WS] close", { id: ws.id, room: ws.room, playerId: ws.playerId });
  });
});

// Keepalive (Render free instance’larda uzun süreli bağlantılara yardımcı olur)
const pingInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      try { ws.terminate(); } catch {}
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 30000);

wss.on("close", () => clearInterval(pingInterval));
