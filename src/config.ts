// src/config.ts
export const WS_URL = "wss://suiloop.onrender.com/ws"; // <-- /ws ÖNEMLİ
export const BASE_URL =
  (typeof window !== "undefined" ? window.location.origin : "");
