import { io } from "socket.io-client";
export const API_URL =
  (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:4000";
export const socket = io(API_URL, { transports: ["websocket"] });
