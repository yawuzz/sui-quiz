// src/config.ts
// Build sırasında asla throw atma. Prod'da env yoksa Render WSS'e düş.
export const WS_URL: string =
  (import.meta.env.VITE_WS_URL as string | undefined) ||
  "wss://suiloop.onrender.com/ws";

export const BASE_URL: string =
  (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) ||
  (typeof window !== "undefined" ? window.location.origin : "");
