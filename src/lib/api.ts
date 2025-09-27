export type Question = {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  points: number;
  durationSec: number;
};

export type CreateRoomBody = {
  roomCode: string;
  prizeMode: "SBT" | "COIN" | "BOTH";
  questions: Question[];
};

const API_URL = (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:4000";

async function asJson<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export async function createRoom(body: CreateRoomBody) {
  const r = await fetch(`${API_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return asJson<{ ok: true }>(r);
}

export async function finalizeRoom(roomCode: string, mode?: "SBT"|"COIN"|"BOTH") {
  const r = await fetch(`${API_URL}/api/rooms/${roomCode}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mode ? { mode } : {}),
  });
  return asJson<{
    leaderboard: { playerId: string; name: string; score: number }[];
    suiTxDigest?: string;
    mintedSBTs?: { address: string; objectId: string }[];
  }>(r);
}
