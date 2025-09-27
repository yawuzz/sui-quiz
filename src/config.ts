// src/config.ts
const envUrl = import.meta.env.VITE_WS_URL as string | undefined;

if (!envUrl) {
  // Prod’da env zorunlu; local dev’de .env.local kullan.
  throw new Error("VITE_WS_URL is not set. Set it on Vercel to your Render WSS URL.");
}

export const WS_URL = envUrl;                     // ör: wss://suiloop.onrender.com/ws
export const BASE_URL =
  (typeof window !== "undefined" ? window.location.origin : "");
