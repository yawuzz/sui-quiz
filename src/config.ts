// src/config.ts
// Prod'da env yoksa bile Render WS'e bağlanacak güvenli fallback.
// (TLS + /ws yolu ZORUNLU)
export const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ||
  "wss://suiloop.onrender.com/ws";

export const BASE_URL =
  (typeof window !== "undefined" ? window.location.origin : "");
