// src/config.ts
// Tek kaynaktan WS URL.
// Prod’da Vercel env’de zorunlu: VITE_WS_URL = wss://<render-app>.onrender.com/ws

const envUrl = import.meta.env.VITE_WS_URL as string | undefined;

if (!envUrl) {
  // Lokal geliştiriyorsan .env.local içine:
  // VITE_WS_URL=ws://localhost:3001/ws
  // Prod’da ise Vercel env’e wss://.../ws gir.
  console.warn("VITE_WS_URL is not set. Falling back to localhost for dev.");
}

export const WS_URL: string = envUrl ?? "ws://localhost:3001/ws";

export const BASE_URL: string =
  (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) ||
  (typeof window !== "undefined" ? window.location.origin : "");
