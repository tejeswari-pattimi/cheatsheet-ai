// vite.config.ts
import { defineConfig } from "vite"
import electron from "vite-plugin-electron"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // Only use vite-plugin-electron in production build
    ...(command === 'build' ? [
      electron([
        {
          // main.ts
          entry: "electron/main.ts",
          vite: {
            build: {
              outDir: "dist-electron",
              sourcemap: true,
              minify: false,
              rollupOptions: {
                external: [
                  "electron",
                  "sharp",
                  "screenshot-desktop",
                  "tesseract.js",
                  "@nut-tree-fork/nut-js",
                  "electron-store",
                  "electron-updater",
                  "electron-log"
                ]
              }
            }
          }
        },
        {
          // preload.ts
          entry: "electron/preload.ts",
          vite: {
            build: {
              outDir: "dist-electron",
              sourcemap: true,
              rollupOptions: {
                external: ["electron"]
              }
            }
          }
        }
      ])
    ] : [])
  ],
  base: process.env.NODE_ENV === "production" ? "./" : "/",
  server: {
    port: 54321,
    strictPort: true,
    watch: {
      usePolling: true
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
}))
