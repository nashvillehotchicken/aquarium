import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    minify: "terser",
    terserOptions: {
      compress: { drop_console: true },
      mangle: true,
    },
    rollupOptions: {
      input: { main: "./index.html" },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
