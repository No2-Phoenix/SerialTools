import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
import path from "path";

export default defineConfig(async () => ({
  plugins: [
    vue(),
    Components({
      dts: "src/components.d.ts",
      resolvers: [NaiveUiResolver()],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("naive-ui")) return "naive-ui";
          if (id.includes("lucide-vue-next") || id.includes("@vicons")) return "icons";
          if (id.includes("@tauri-apps/api")) return "tauri-api";
          return undefined;
        },
      },
    },
  },
}));
