// Tek WS endpoint'in bu kalsın (Render).
export const WS_URL = "wss://suiloop.onrender.com/ws";

// ÖNEMLİ: Join URL her zaman mevcut sitenin kökünden üretilecek.
// Böylece yanlışlıkla Render (API) domainine gitmez.
export const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";
