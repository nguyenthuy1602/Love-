import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://love-app-igja.onrender.com",
        changeOrigin: true,
      },
      "/chat": {
        target: "wss://love-app-igja.onrender.com",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
