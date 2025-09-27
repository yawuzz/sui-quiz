// src/config.ts
// Tek kaynaktan WS & Base URL

export const WS_URL: string = (() => {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  // Production'da env zorunlu (localhost'ta dev fallback'a izin ver)
  if (!envUrl && !isLocal) {
    throw new Error("VITE_WS_URL is not set. Set it on Vercel to your Render WSS URL.");
  }
  return envUrl ?? "ws://localhost:3001"; // sadece local geliştirme için
})();

export const BASE_URL: string =
  (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) ||
  (typeof window !== "undefined" ? window.location.origin : "");
