import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173 },
  build: {
    // Le SDK Firebase pèse ~550 ko minifié (~150 ko gzip) : on le sépare pour qu'il reste en cache entre deux versions.
    chunkSizeWarningLimit: 800,
    rollupOptions: { output: { manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore"] } } },
  },
});
