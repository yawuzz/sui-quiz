// src/config.ts
export const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ||
  "wss://suiloop.onrender.com/ws";

export const BASE_URL =
  (typeof window !== "undefined" ? window.location.origin : "");
