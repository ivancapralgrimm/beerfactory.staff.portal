import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { resolveKnowledgeSource } from "./src/features/knowledge/knowledge-source.ts";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    define: {
      "import.meta.env.VITE_KNOWLEDGE_SOURCE": JSON.stringify(
        resolveKnowledgeSource({
          requested: env.VITE_KNOWLEDGE_SOURCE,
          mode,
          deploymentEnv: env.VERCEL_ENV,
          branch: env.VERCEL_GIT_COMMIT_REF,
        }),
      ),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        injectRegister: "auto",
        includeAssets: [
          "assets/icons/apple-touch-icon.png",
          "assets/icons/icon-192.png",
          "assets/icons/icon-512.png",
          "assets/icons/icon-maskable-512.png",
          "assets/icons/profile-avatar.png",
          "push-sw.js",
        ],
        manifest: {
          id: "/",
          name: "BeerFactory Staff Portal",
          short_name: "BF Staff",
          description: "Рабочий портал персонала BeerFactory",
          start_url: "/#/",
          scope: "/",
          display: "standalone",
          background_color: "#14100d",
          theme_color: "#14100d",
          icons: [
            {
              src: "/assets/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/assets/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/assets/icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: "/index.html",
          importScripts: ["push-sw.js"],
          globPatterns: [
            "**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,json,txt}",
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": srcDir,
      },
    },
    build: {
      target: "es2022",
      sourcemap: true,
    },
  };
});
