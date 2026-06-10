import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4071,
    proxy: { "/api": "http://127.0.0.1:4070" },
  },
  build: { outDir: "dist" },
});
