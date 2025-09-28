// HTTP + WebSocket aynı portta, WS path: /ws
const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

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

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  if (!req.url || !req.url.startsWith("/ws")) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

// rooms: { sockets:Set<ws>, players:Map<ws,{...}>, ... }
const rooms = new Map();

function broadcast(roomCode, msg) {
  const r = rooms.get(roomCode);
  if (!r) return;
  const data = JSON.stringify(msg);
  for (const ws of r.sockets) {
    try { ws.send(data); } catch {}
  }
}

function sendState(roomCode) {
  const r = rooms.get(roomCode);
  if (!r) return;
  const players = [...r.players.values()].map(p => ({
    id: p.id, name: p.name, score: p.score, addr: p.addr || null
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
  if (!q) return finalize(roomCode);

  r.currentEndsAt = Date.now() + q.durationSec * 1000;

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
  if (!q) return finalize(roomCode);

  for (const p of r.players.values()) {
    const choice = r.answers.get(p.id);
    if (choice === q.correctIndex) p.score += q.points;
  }

  const leaderboard = [...r.players.values()]
    .sort((a,b)=> (b.score||0)-(a.score||0))
    .map(p => ({ id:p.id, name:p.name, score:p.score||0, addr:p.addr||null }));

  const nextAt = Date.now() + 5000;
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
    .sort((a,b)=> (b.score||0)-(a.score||0))
    .map(p => ({ id:p.id, name:p.name, score:p.score||0, addr:p.addr||null }));

  r.started = false;
  r.currentIndex = -1;
  r.currentEndsAt = 0;

  broadcast(roomCode, { type: "final", room: roomCode, leaderboard });
}

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

      if (!rooms.has(room)) {
        rooms.set(room, {
          sockets: new Set(),
          players: new Map(),
          started: false,
          questions: [],
          currentIndex: -1,
          currentEndsAt: 0,
          answers: new Map(),
          timer: undefined,
        });
      }
      const r = rooms.get(room);
      r.sockets.add(ws);     // HOST + PLAYER hepsi yayın alır
      sendState(room);
      return;
    }

    if (!myRoom) return;
    const r = rooms.get(myRoom);
    if (!r) return;

    switch (t) {
      case "load_questions":
        r.questions = Array.isArray(msg.questions) ? msg.questions : [];
        r.started = false;
        r.currentIndex = -1;
        r.currentEndsAt = 0;
        r.answers = new Map();
        sendState(myRoom);
        break;

      case "start":
        if (r.questions.length === 0 || r.started) return;
        r.started = true;
        startQuestion(myRoom);
        sendState(myRoom);
        break;

      case "end":
        finalize(myRoom);
        break;

      case "join": {
        const name = String(msg.name || "Player");
        const addr = msg.addr || msg.address || null;
        const id = crypto.randomUUID();
        myId = id;

        r.players.set(ws, { id, name, score: 0, ws, addr });
        sendState(myRoom);
        break;
      }

      case "leave":
        if (r.players.has(ws)) {
          r.players.delete(ws);
          sendState(myRoom);
        }
        break;

      case "answer": {
        const { index, choice } = msg;
        if (!r.started) return;
        if (index !== r.currentIndex) return;
        if (Date.now() > r.currentEndsAt) return;
        if (!myId) return;
        if (r.answers.has(myId)) return;

        r.answers.set(myId, Number(choice));

        if (r.players.size > 0 && r.answers.size >= r.players.size) {
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
      if (r) {
        r.sockets.delete(ws);
        if (r.players.has(ws)) r.players.delete(ws);
        sendState(myRoom);
      }
    }
  });
});
