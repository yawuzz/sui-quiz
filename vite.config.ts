// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  define: {
    global: "globalThis",
    "process.env": {}, // bazı paketlerin process.env kullanımını stub’lar
  },
  build: { target: "es2020" },
});
