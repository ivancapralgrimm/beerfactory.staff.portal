import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
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
        "assets/icons/profile-avatar.png"
      ],
      manifest: {
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
            purpose: "any"
          },
          {
            src: "/assets/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/assets/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,json,txt}"]
      }
    })
  ],
  resolve: {
    alias: {
      "@": srcDir
    }
  },
  build: {
    target: "es2022",
    sourcemap: true
  }
});
