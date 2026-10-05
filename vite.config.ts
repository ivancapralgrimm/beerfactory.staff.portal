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
  const requestedKnowledgeSource = env.VITE_KNOWLEDGE_SOURCE;

  // Production builds are server-authoritative: the editor and reader use the
  // same Supabase source of truth. Keep an explicit legacy override only as a
  // temporary emergency rollback while the old static Knowledge files exist.
  const knowledgeSource =
    mode === "production" && requestedKnowledgeSource !== "legacy"
      ? "supabase"
      : resolveKnowledgeSource({
          requested: requestedKnowledgeSource,
          mode,
          deploymentEnv: env.VERCEL_ENV,
          branch: env.VERCEL_GIT_COMMIT_REF,
        });

  return {
    define: {
      "import.meta.env.VITE_KNOWLEDGE_SOURCE": JSON.stringify(knowledgeSource),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Registration is handled by src/pwa/runtime-recovery.ts so updates can
        // be applied safely at launch instead of trapping installed PWAs on an
        // old service worker.
        registerType: "prompt",
        injectRegister: null,
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
          lang: "ru",
          start_url: "/#/",
          scope: "/",
          display: "standalone",
          background_color: "#f4e5c9",
          theme_color: "#f4e5c9",
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
          // Shell code and local font are precached. Heavy photos, legacy data
          // and training files are no longer downloaded just to install the PWA.
          globPatterns: [
            "**/*.{js,css,html,woff,woff2}",
          ],
          globIgnores: [
            "assets/training-data.txt",
            "assets/training-data.json",
            "assets/questions.txt",
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
      // Use Vite's broadly-supported browser baseline instead of requiring
      // ES2022 from every employee phone.
      target: "baseline-widely-available",
      sourcemap: true,
    },
  };
});
