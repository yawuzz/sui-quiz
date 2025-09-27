// src/config.ts
export const WS_URL =
  import.meta.env.DEV
    ? "ws://localhost:3001/ws"
    : "wss://suiloop.onrender.com/ws";

export const BASE_URL =
  typeof window !== "undefined" ? window.location.origin : "";
