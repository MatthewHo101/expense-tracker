import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["jam-icon.svg", "jam-icon-192.png", "jam-icon-512.png"],
      manifest: {
        name: "Jam Expense Tracker",
        short_name: "Jam",
        description: "Your money, a little clearer.",
        theme_color: "#f5f8f6",
        background_color: "#f5f8f6",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/jam-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/jam-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/jam-icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,woff2,ttf}"] },
    }),
  ],
});
