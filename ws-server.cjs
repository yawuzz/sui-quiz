// ws-server.cjs
const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3001;

/**
 * Room state:
 * {
 *   clients: Set<ws>,
 *   players: Map<socketId, {id, name, score}>,
 *   started: boolean,
 *   questions: Array<{ id, text, options, correctIndex, points, durationSec }>,
 *   qIndex: number,
 *   answers: Map<playerId, { choice, at }>,
 *   endsAt: number,
 *   qTimer: NodeJS.Timeout | null,
 *   advanceTimer: NodeJS.Timeout | null
 * }
 */
const rooms = new Map();
function getOrCreateRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, {
      clients: new Set(),
      players: new Map(),
      started: false,
      questions: [],
      qIndex: -1,
      answers: new Map(),
      endsAt: 0,
      qTimer: null,
      advanceTimer: null,
    });
  }
  return rooms.get(code);
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function broadcast(roomCode, obj) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(obj);
  for (const ws of room.clients) { try { ws.send(data); } catch {} }
}
function sendState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const players = Array.from(room.players.values());
  broadcast(roomCode, { type: "state", room: roomCode, players, started: room.started });
}
function clearTimers(room) {
  if (room.qTimer) { clearTimeout(room.qTimer); room.qTimer = null; }
  if (room.advanceTimer) { clearTimeout(room.advanceTimer); room.advanceTimer = null; }
}
function reveal(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  clearTimers(room);

  const q = room.questions[room.qIndex];
  if (!q) return;
  const durationMs = q.durationSec * 1000;
  const correct = q.correctIndex;

  for (const [pid, p] of room.players) {
    const ans = room.answers.get(pid);
    if (!ans) continue;
    if (ans.choice === correct) {
      const base = q.points;
      const remain = Math.max(0, room.endsAt - ans.at);
      const bonus = Math.floor((remain / durationMs) * Math.floor(q.points / 2));
      p.score = (p.score || 0) + base + bonus;
    }
  }
  const leaderboard = Array.from(room.players.values())
    .map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score);

  const nextAt = Date.now() + 5000;
  broadcast(roomCode, {
    type: "results",
    room: roomCode,
    index: room.qIndex,
    correctIndex: correct,
    leaderboard,
    nextAt
  });

  room.advanceTimer = setTimeout(() => nextQuestion(roomCode), 5000);
}
function endGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  room.started = false;
  clearTimers(room);
  const leaderboard = Array.from(room.players.values())
    .map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score);
  broadcast(roomCode, { type: "final", room: roomCode, leaderboard });
}
function nextQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  clearTimers(room);

  room.qIndex += 1;
  if (room.qIndex >= room.questions.length) {
    endGame(roomCode);
    return;
  }
  room.answers = new Map();
  const q = room.questions[room.qIndex];
  room.endsAt = Date.now() + q.durationSec * 1000;

  broadcast(roomCode, {
    type: "question",
    room: roomCode,
    index: room.qIndex,
    text: q.text,
    options: q.options,
    durationSec: q.durationSec,
    points: q.points,
    endsAt: room.endsAt
  });

  room.qTimer = setTimeout(() => reveal(roomCode), q.durationSec * 1000);
}

// --- HTTP server (healthcheck için 200 OK döner) ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ok");
});

// --- WebSocket ---
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  const socketId = uid();
  let roomCode = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "subscribe" && msg.room) {
      roomCode = msg.room;
      const room = getOrCreateRoom(roomCode);
      room.clients.add(ws);
      sendState(roomCode);
      return;
    }

    if (!roomCode) return;
    const room = getOrCreateRoom(roomCode);

    if (msg.type === "load_questions" && Array.isArray(msg.questions)) {
      clearTimers(room);
      room.questions = msg.questions;
      room.qIndex = -1;
      room.started = false;
      sendState(roomCode);
      return;
    }
    if (msg.type === "join" && msg.name) {
      room.players.set(socketId, { id: socketId, name: String(msg.name), score: 0 });
      sendState(roomCode);
      return;
    }
    if (msg.type === "leave") {
      room.players.delete(socketId);
      sendState(roomCode);
      return;
    }
    if (msg.type === "start") {
      room.started = true;
      sendState(roomCode);
      nextQuestion(roomCode);
      return;
    }
    if (msg.type === "next") { if (!room.qTimer) nextQuestion(roomCode); return; }
    if (msg.type === "end")  { endGame(roomCode); return; }
    if (msg.type === "answer" && typeof msg.index === "number" && typeof msg.choice === "number") {
      if (msg.index !== room.qIndex) return;
      if (Date.now() > room.endsAt) return;
      if (room.answers.has(socketId)) return;
      room.answers.set(socketId, { choice: msg.choice, at: Date.now() });

      if (room.answers.size >= room.players.size && room.players.size > 0) {
        if (room.qTimer) { clearTimeout(room.qTimer); room.qTimer = null; }
        reveal(roomCode);
      }
      return;
    }
  });

  ws.on("close", () => {
    if (!roomCode) return;
    const room = getOrCreateRoom(roomCode);
    room.clients.delete(ws);
    room.players.delete(socketId);
    sendState(roomCode);
  });
});

server.listen(PORT, () => {
  console.log(`WS server on ws://localhost:${PORT}`);
});
