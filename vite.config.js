import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.split(path.sep).join("/");
          // Keep workspace UI behind its dynamic import boundary.
          // Grouping eager controllers with lazy screens forces those screens into startup.
          if (!normalizedId.includes("node_modules")) return undefined;
          if (normalizedId.includes("lucide-react")) return "icons";
          if (normalizedId.includes("react") || normalizedId.includes("scheduler")) return "react-vendor";
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
