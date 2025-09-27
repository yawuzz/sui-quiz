// ws-server.cjs
// Tek HTTP + WS sunucu, WS endpoint: /ws
const http = require("http");
const { WebSocketServer } = require("ws");
const url = require("url");

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);
  if (pathname === "/healthz") {
    res.writeHead(200).end("ok");
    return;
  }
  res.writeHead(200).end("Sui Quiz WS");
});

const wss = new WebSocketServer({ noServer: true });

// ---- In-memory state ----
/*
rooms: {
  [ROOM]: {
    subs: Set<ws>,                          // odaya abone tüm socket’ler (host + player)
    players: Map<ws, {id,name,score}>,      // oyuncular (ws bazlı)
    questions: [],                          // host'un yüklediği soru listesi
    started: false,
    curIndex: -1,
    curStart: 0,                            // ms
    curEndsAt: 0,                           // ms
    answers: Map<ws, {choice, t}>           // cevaplar (soru başına)
  }
}
*/
const rooms = new Map();

// yardımcılar
const now = () => Date.now();
const up = (s) => (s || "").trim().toUpperCase();

function ensureRoom(code) {
  code = up(code);
  if (!rooms.has(code)) {
    rooms.set(code, {
      subs: new Set(),
      players: new Map(),
      questions: [],
      started: false,
      curIndex: -1,
      curStart: 0,
      curEndsAt: 0,
      answers: new Map(),
    });
  }
  return rooms.get(code);
}

function roomStatePayload(code) {
  const r = rooms.get(up(code));
  return {
    type: "state",
    room: up(code),
    started: !!r?.started,
    players: r ? [...r.players.values()].map(p => ({ id: p.id, name: p.name, score: p.score || 0 })) : [],
  };
}

function sendToRoom(code, obj) {
  const r = rooms.get(up(code));
  if (!r) return;
  const msg = JSON.stringify(obj);
  for (const ws of r.subs) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function sendCurrentQuestionTo(ws, code) {
  const r = rooms.get(up(code));
  if (!r) return;
  if (r.started && r.curIndex >= 0 && r.curIndex < r.questions.length) {
    const q = r.questions[r.curIndex];
    ws.send(JSON.stringify({
      type: "question",
      room: up(code),
      index: r.curIndex,
      text: q.text,
      options: q.options,
      points: q.points,
      endsAt: r.curEndsAt,
    }));
  }
}

function broadcastState(code) {
  sendToRoom(code, roomStatePayload(code));
}

function startQuestion(code, index) {
  const r = rooms.get(up(code));
  if (!r) return;
  if (index < 0 || index >= r.questions.length) return;

  r.curIndex = index;
  r.curStart = now();
  const q = r.questions[index];
  r.curEndsAt = r.curStart + (q.durationSec * 1000);
  r.answers = new Map();

  sendToRoom(code, {
    type: "question",
    room: up(code),
    index,
    text: q.text,
    options: q.options,
    points: q.points,
    endsAt: r.curEndsAt,
  });

  // Süre bitince finalize
  setTimeout(() => {
    finalizeQuestion(code);
  }, q.durationSec * 1000);
}

function finalizeQuestion(code) {
  const r = rooms.get(up(code));
  if (!r) return;
  if (r.curIndex < 0) return;

  const q = r.questions[r.curIndex];
  const total = q.durationSec * 1000;

  // Skorları güncelle
  for (const [ws, ans] of r.answers.entries()) {
    const player = r.players.get(ws);
    if (!player) continue;
    const elapsed = Math.max(0, ans.t - r.curStart);
    const speedFactor = Math.max(0, 1 - elapsed / total);
    const correct = ans.choice === q.correctIndex;
    const award = correct ? Math.round(q.points * speedFactor) : 0; // yanlış = 0
    player.score = (player.score || 0) + award;
  }

  // Leaderboard
  const leaderboard = [...r.players.values()]
    .map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score);

  // Son soru mu?
  const last = r.curIndex === r.questions.length - 1;
  if (last) {
    sendToRoom(code, { type: "final", room: up(code), leaderboard });
    r.started = false;
    r.curIndex = -1;
    broadcastState(code);
    return;
  }

  const nextAt = now() + 5000; // 5sn leaderboard
  sendToRoom(code, {
    type: "results",
    room: up(code),
    index: r.curIndex,
    correctIndex: q.correctIndex,
    leaderboard,
    nextAt,
  });

  setTimeout(() => startQuestion(code, r.curIndex + 1), 5000);
}

server.on("upgrade", (req, socket, head) => {
  const { pathname } = url.parse(req.url);
  if (pathname !== "/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws) => {
  let myRoom = null;

  ws.on("message", (data) => {
    let msg = null;
    try { msg = JSON.parse(data.toString()); } catch {}
    if (!msg) return;

    const type = msg.type;
    const room = up(msg.room || "");
    if (!room) return;

    const r = ensureRoom(room);

    if (type === "subscribe") {
      myRoom = room;
      r.subs.add(ws);
      // abone olunca anlık state
      ws.send(JSON.stringify(roomStatePayload(room)));
      // şu an soru varsa yeni aboneye gönder
      sendCurrentQuestionTo(ws, room);
      return;
    }

    if (type === "load_questions") {
      // sadece host akışında geliyor (Room ekranı)
      r.questions = Array.isArray(msg.questions) ? msg.questions : [];
      r.started = false;
      r.curIndex = -1;
      broadcastState(room);
      return;
    }

    if (type === "join") {
      const name = (msg.name || "").toString().slice(0, 40);
      if (!name) return;
      const player = { id: Math.random().toString(36).slice(2, 10), name, score: 0 };
      r.players.set(ws, player);
      broadcastState(room);
      // Eğer soru açık ise yeni oyuncuya da anlık soru gönder (cevap verebilsin)
      sendCurrentQuestionTo(ws, room);
      return;
    }

    if (type === "leave") {
      r.players.delete(ws);
      broadcastState(room);
      return;
    }

    if (type === "start") {
      if (!r.questions.length) return;
      r.started = true;
      startQuestion(room, 0);
      broadcastState(room);
      return;
    }

    if (type === "end") {
      // final leaderboard
      const leaderboard = [...r.players.values()]
        .map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
        .sort((a, b) => b.score - a.score);
      sendToRoom(room, { type: "final", room: room, leaderboard });
      r.started = false;
      r.curIndex = -1;
      broadcastState(room);
      return;
    }

    if (type === "answer") {
      if (!r.started || r.curIndex < 0) return;
      if (!r.players.has(ws)) return;
      if (r.answers.has(ws)) return; // tek cevap
      const i = Number(msg.index);
      if (i !== r.curIndex) return;
      const choice = Number(msg.choice);
      if (!Number.isInteger(choice)) return;

      // süre içinde mi?
      const t = now();
      if (t > r.curEndsAt) return;
      r.answers.set(ws, { choice, t });

      // herkes cevapladıysa hemen finalize
      if (r.answers.size >= r.players.size) {
        finalizeQuestion(room);
      }
      return;
    }
  });

  ws.on("close", () => {
    if (myRoom) {
      const r = rooms.get(myRoom);
      if (r) {
        r.subs.delete(ws);
        if (r.players.delete(ws)) {
          broadcastState(myRoom);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`HTTP on http://0.0.0.0:${PORT}  |  WS on ws://0.0.0.0:${PORT}/ws`);
});
