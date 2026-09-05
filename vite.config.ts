import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Required for GitHub Pages: the site serves from /prompt-compressor/
  base: "/prompt-compressor/",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
});
