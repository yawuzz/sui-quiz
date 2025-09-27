// src/config.ts
export const WS_URL = "wss://suiloop.onrender.com/ws";  // Render WS
export const BASE_URL =
  (typeof window !== "undefined" ? window.location.origin : "");
