import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Load self-signed certs for HTTPS (required for getUserMedia on mobile)
const certPath = path.resolve(import.meta.dirname, "../certs/cert.pem");
const keyPath = path.resolve(import.meta.dirname, "../certs/key.pem");
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 4739,
    https: hasCerts
      ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
      : undefined,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
