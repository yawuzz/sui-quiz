// HTTP + WebSocket aynı portta, WS path: /ws
const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

// --- Mini HTTP (health + basit kök sayfa) ---
const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Sui Quiz WS");
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP on http://0.0.0.0:${PORT}  |  WS on ws://0.0.0.0:${PORT}/ws`);
});

// --- WS upgrade sadece /ws için ---
const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  if (!req.url || !req.url.startsWith("/ws")) {
    socket.destroy();
    return;
  }
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    console.log("[UPGRADE]", req.url, "from", ip);
  } catch {}
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

// --- In-memory state ---
// rooms: Map<roomCode, {
//   players: Map<WebSocket, { id, name, score, ws, addr: string|null }>,
//   started: boolean,
//   questions: Array<{ id,text,options,correctIndex,points,durationSec }>,
//   currentIndex: number,
//   currentEndsAt: number,
//   answers: Map<string /*playerId*/, number /*choice*/>,
//   timer?: NodeJS.Timeout,
// }>
const rooms = new Map();

// --- Helpers ---
function broadcast(roomCode, msg) {
  const r = rooms.get(roomCode);
  if (!r) return;
  const data = JSON.stringify(msg);
  for (const [ws] of r.players) {
    try { ws.send(data); } catch {}
  }
}

function sendState(roomCode) {
  const r = rooms.get(roomCode);
  if (!r) return;
  const players = [...r.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    addr: p.addr || null,
  }));
  broadcast(roomCode, { type: "state", room: roomCode, started: r.started, players });
}

function getCurrentQuestion(roomCode) {
  const r = rooms.get(roomCode);
  if (!r) return null;
  if (r.currentIndex < 0 || r.currentIndex >= r.questions.length) return null;
  return r.questions[r.currentIndex];
}

function startQuestion(roomCode) {
  const r = rooms.get(roomCode);
  if (!r) return;

  r.currentIndex += 1;
  r.answers = new Map();

  const q = getCurrentQuestion(roomCode);
  if (!q) {
    finalize(roomCode);
    return;
  }

  r.currentEndsAt = Date.now() + q.durationSec * 1000;

  console.log("[WS]", roomCode, "question →", r.currentIndex, `"${q.text.slice(0, 40)}..."`);

  broadcast(roomCode, {
    type: "question",
    room: roomCode,
    index: r.currentIndex,
    text: q.text,
    options: q.options,
    points: q.points,
    endsAt: r.currentEndsAt,
  });

  if (r.timer) clearTimeout(r.timer);
  r.timer = setTimeout(() => finishQuestion(roomCode), q.durationSec * 1000);
}

function finishQuestion(roomCode) {
  const r = rooms.get(roomCode);
  if (!r) return;

  const q = getCurrentQuestion(roomCode);
  if (!q) {
    finalize(roomCode);
    return;
  }

  // Puanlama: sadece doğru cevaba puan
  for (const p of r.players.values()) {
    const choice = r.answers.get(p.id);
    if (choice === q.correctIndex) {
      p.score += q.points;
    }
  }

  const leaderboard = [...r.players.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((p) => ({ id: p.id, name: p.name, score: p.score || 0, addr: p.addr || null }));

  console.log("[WS]", roomCode, "results Q", r.currentIndex, "answers:", r.answers.size, "/", r.players.size);

  const nextAt = Date.now() + 5000; // 5 sn sonra otomatik sonraki soru
  broadcast(roomCode, {
    type: "results",
    room: roomCode,
    index: r.currentIndex,
    correctIndex: q.correctIndex,
    leaderboard,
    nextAt,
  });

  if (r.timer) clearTimeout(r.timer);
  r.timer = setTimeout(() => startQuestion(roomCode), 5000);
}

function finalize(roomCode) {
  const r = rooms.get(roomCode);
  if (!r) return;
  if (r.timer) clearTimeout(r.timer);

  const leaderboard = [...r.players.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((p) => ({ id: p.id, name: p.name, score: p.score || 0, addr: p.addr || null }));

  r.started = false;
  r.currentIndex = -1;
  r.currentEndsAt = 0;

  console.log("[WS]", roomCode, "finalize, players:", r.players.size);
  broadcast(roomCode, { type: "final", room: roomCode, leaderboard });
}

// --- Connection ---
wss.on("connection", (ws) => {
  let myRoom = null;
  let myId = null;

  ws.on("message", (buf) => {
    let msg = null;
    try { msg = JSON.parse(buf.toString()); } catch { return; }
    const t = msg?.type;

    if (t === "subscribe") {
      const room = String(msg.room || "").toUpperCase();
      if (!room) return;
      myRoom = room;
      console.log("[WS] subscribe →", room);

      if (!rooms.has(room)) {
        rooms.set(room, {
          players: new Map(),
          started: false,
          questions: [],
          currentIndex: -1,
          currentEndsAt: 0,
          answers: new Map(),
          timer: undefined,
        });
      }
      sendState(room);
      return;
    }

    if (!myRoom) return; // önce subscribe edilmeli
    const r = rooms.get(myRoom);
    if (!r) return;

    switch (t) {
      case "load_questions": {
        r.questions = Array.isArray(msg.questions) ? msg.questions : [];
        r.started = false;
        r.currentIndex = -1;
        r.currentEndsAt = 0;
        r.answers = new Map();
        console.log("[WS]", myRoom, "load_questions:", r.questions.length);
        sendState(myRoom);
        break;
      }

      case "start": {
        console.log("[WS]", myRoom, "start");
        if (r.questions.length === 0 || r.started) return;
        r.started = true;
        startQuestion(myRoom);
        sendState(myRoom);
        break;
      }

      case "end": {
        console.log("[WS]", myRoom, "end");
        finalize(myRoom);
        break;
      }

      case "join": {
        const name = String(msg.name || "Player");
        // client hem `addr` hem `address` gönderebilir; ikisini de destekle
        const addr = msg.addr || msg.address || null;
        const id = crypto.randomUUID();
        myId = id;

        r.players.set(ws, {
          id,
          name,
          score: 0,
          ws,
          addr,
        });

        console.log("[WS]", myRoom, "join:", name, "players:", r.players.size);
        sendState(myRoom);
        break;
      }

      case "leave": {
        if (r.players.has(ws)) {
          r.players.delete(ws);
          console.log("[WS]", myRoom, "leave → players:", r.players.size);
          sendState(myRoom);
        }
        break;
      }

      case "answer": {
        const { index, choice } = msg;
        if (!r.started) return;
        if (index !== r.currentIndex) return;           // farklı soru
        if (Date.now() > r.currentEndsAt) return;       // süre doldu
        if (!myId) return;                               // join edilmemiş
        if (r.answers.has(myId)) return;                 // ikinci cevap yok

        r.answers.set(myId, Number(choice));
        console.log("[WS]", myRoom, "answer from", myId, "choice:", choice, "progress:", r.answers.size, "/", r.players.size);

        // herkes cevapladıysa beklemeden bitir
        const total = r.players.size;
        const answered = r.answers.size;
        if (total > 0 && answered >= total) {
          if (r.timer) clearTimeout(r.timer);
          finishQuestion(myRoom);
        }
        break;
      }
    }
  });

  ws.on("close", () => {
    if (myRoom) {
      const r = rooms.get(myRoom);
      if (r && r.players.has(ws)) {
        r.players.delete(ws);
        console.log("[WS]", myRoom, "disconnect → players:", r.players.size);
        sendState(myRoom);
      }
    }
  });
});
