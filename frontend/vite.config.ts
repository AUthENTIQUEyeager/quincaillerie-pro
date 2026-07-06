import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    legacy({
      // Bundle "moderne" : transpile quand même la syntaxe récente (optional
      // chaining "?.", nullish coalescing "??"...) pour rester compatible avec
      // des navigateurs qui supportent les modules ES mais pas cette syntaxe
      // (ex: Chrome 61 à 79, encore utilisé sur certains postes de bureau figés).
      modernTargets: ["chrome >= 70", "edge >= 79", "firefox >= 78", "safari >= 12"],
      modernPolyfills: true,
      // Bundle de secours pour les navigateurs encore plus anciens, sans
      // support des modules ES du tout (avant ~2017).
      targets: ["defaults", "not IE 11", "chrome >= 49", "safari >= 10"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
