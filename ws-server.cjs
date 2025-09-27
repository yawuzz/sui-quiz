// ws-server.cjs
// Tek HTTP + WS sunucu, /ws yolunda upgrade

const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3001;

// Basit HTTP: kök sayfa ve health
const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Sui Quiz WS\n");
  } else if (req.url === "/healthz") {
    res.writeHead(200);
    res.end("ok");
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

// WS sunucuyu “noServer” modunda açıyoruz; upgrade'i kendimiz yapacağız
const wss = new WebSocketServer({ noServer: true });

// ---- Oda durumu (in-memory) ----
const rooms = new Map(); // ROOM -> { clients:Set<ws>, players:Map<ws,{id,name,score}>, questions:[], started:false, ... }

function getRoom(ROOM) {
  if (!rooms.has(ROOM)) {
    rooms.set(ROOM, {
      clients: new Set(),
      players: new Map(),
      questions: [],
      started: false,
      currentIndex: -1,
      endsAt: 0
    });
  }
  return rooms.get(ROOM);
}

function broadcast(ROOM, data) {
  const room = rooms.get(ROOM);
  if (!room) return;
  const msg = JSON.stringify(data);
  room.clients.forEach((ws) => {
    try { ws.send(msg); } catch {}
  });
}

// ---- WS bağlantı/mesaj mantığı ----
wss.on("connection", (ws) => {
  let joinedRoom = null;

  ws.on("message", (raw) => {
    let msg = null;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const { type, room } = msg || {};
    if (!type || !room) return;

    const ROOM = String(room).trim().toUpperCase();
    const r = getRoom(ROOM);

    if (type === "subscribe") {
      joinedRoom = ROOM;
      r.clients.add(ws);
      // İlk state
      broadcast(ROOM, {
        type: "state",
        room: ROOM,
        started: r.started,
        players: Array.from(r.players.values()).map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
      });
      return;
    }

    if (!joinedRoom || joinedRoom !== ROOM) {
      // önce subscribe edilmemişse
      return;
    }

    if (type === "load_questions") {
      // Host'tan gelir
      const { questions } = msg;
      if (Array.isArray(questions) && questions.length) {
        r.questions = questions.map(q => ({
          id: q.id, text: q.text,
          options: q.options, correctIndex: q.correctIndex,
          points: q.points, durationSec: q.durationSec
        }));
      }
      return;
    }

    if (type === "join") {
      // Oyuncu
      const name = String(msg.name || "").trim();
      if (!name) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      r.players.set(ws, { id, name, score: 0 });
      broadcast(ROOM, {
        type: "state",
        room: ROOM,
        started: r.started,
        players: Array.from(r.players.values()).map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
      });
      return;
    }

    if (type === "leave") {
      r.players.delete(ws);
      broadcast(ROOM, {
        type: "state",
        room: ROOM,
        started: r.started,
        players: Array.from(r.players.values()).map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
      });
      return;
    }

    if (type === "start") {
      if (!r.questions.length) return;
      r.started = true;
      r.currentIndex = -1;
      nextQuestion(ROOM);
      return;
    }

    if (type === "answer") {
      const { index, choice } = msg;
      if (index !== r.currentIndex) return;
      const player = r.players.get(ws);
      if (!player) return;
      // İlk cevabı kilitleme (tekrarla puan toplanmasın)
      if (player._answeredIndex === index) return;
      player._answeredIndex = index;

      const q = r.questions[index];
      const correct = q.correctIndex;
      if (choice === correct) {
        // basit puan: kalan süre * (puan/duration) ama şimdilik sadece tam puan
        player.score = (player.score || 0) + q.points;
      }
      // Tüm oyuncular cevapladıysa erken bitir
      const total = r.players.size;
      const answered = Array.from(r.players.values()).filter(p => p._answeredIndex === index).length;
      if (total > 0 && answered === total) {
        // erken sonuç
        sendResults(ROOM);
      }
      return;
    }

    if (type === "end") {
      // Final
      const leaderboard = Array.from(r.players.values())
        .map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
        .sort((a,b) => b.score - a.score);
      broadcast(ROOM, { type: "final", room: ROOM, leaderboard });
      r.started = false;
      r.currentIndex = -1;
      return;
    }
  });

  ws.on("close", () => {
    if (!joinedRoom) return;
    const r = rooms.get(joinedRoom);
    if (!r) return;
    r.clients.delete(ws);
    if (r.players.has(ws)) {
      r.players.delete(ws);
      broadcast(joinedRoom, {
        type: "state",
        room: joinedRoom,
        started: r.started,
        players: Array.from(r.players.values()).map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
      });
    }
  });
});

// Soru gönderme + bitişte sonuç
function nextQuestion(ROOM) {
  const r = rooms.get(ROOM);
  if (!r) return;
  r.currentIndex++;
  if (r.currentIndex >= r.questions.length) {
    const leaderboard = Array.from(r.players.values())
      .map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
      .sort((a,b) => b.score - a.score);
    broadcast(ROOM, { type: "final", room: ROOM, leaderboard });
    r.started = false;
    r.currentIndex = -1;
    return;
  }
  const q = r.questions[r.currentIndex];
  const now = Date.now();
  r.endsAt = now + q.durationSec * 1000;

  // Her oyuncunun cevap kilidini sıfırla
  r.players.forEach(p => { delete p._answeredIndex; });

  broadcast(ROOM, {
    type: "question",
    room: ROOM,
    index: r.currentIndex,
    text: q.text,
    options: q.options,
    points: q.points,
    endsAt: r.endsAt
  });

  // Süre sonunda otomatik sonuç
  setTimeout(() => sendResults(ROOM), q.durationSec * 1000);
}

function sendResults(ROOM) {
  const r = rooms.get(ROOM);
  if (!r || r.currentIndex < 0) return;
  const q = r.questions[r.currentIndex];
  const leaderboard = Array.from(r.players.values())
    .map(p => ({ id: p.id, name: p.name, score: p.score || 0 }))
    .sort((a,b) => b.score - a.score);

  // 5 sn sonra otomatik sonraki soru
  const nextAt = Date.now() + 5000;
  broadcast(ROOM, {
    type: "results",
    room: ROOM,
    index: r.currentIndex,
    correctIndex: q.correctIndex,
    leaderboard,
    nextAt
  });
  setTimeout(() => nextQuestion(ROOM), 5000);
}

// /ws yoluna gelen upgrade’leri WS’e yönlendir
server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

server.listen(PORT, () => {
  console.log(`HTTP on http://0.0.0.0:${PORT}  |  WS on ws://0.0.0.0:${PORT}/ws`);
});
