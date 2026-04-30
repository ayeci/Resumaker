import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins: PluginOption[] = [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "apple-touch-icon.png",
        "web-app-manifest-192x192.png",
        "web-app-manifest-512x512.png",
      ],
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      manifest: {
        name: "Resumaker",
        short_name: "Resumaker",
        icons: [
          {
            src: "web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
      },
    }),
  ];

  /*// 【裏技】ローカルに basicSsl がインストールされている場合だけ有効化する
  try {
    const basicSslModule = await import('@vitejs/plugin-basic-ssl');
    const basicSsl = basicSslModule.default;
    plugins.push(basicSsl());
  } catch {
    // インストールされていない環境（GitHub Actionsや他の人のPC）では何もしない
  }
  //*/

  return {
    base: "./",
    plugins: plugins,
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom"],
            office: ["docxtemplater", "pizzip"],
            ui: ["lucide-react", "clsx"],
          },
        },
      },
    },
  };
});
