import { defineConfig } from "vite";
import { hmrPlugin, presets } from "vite-plugin-web-components-hmr";

export default defineConfig({
  build: {
    rollupOptions: {
      input: ["./src/all.ts"],
      output: { entryFileNames: "slaks-ui.js" },
    },
  },
  server: {
    cors: { origin: /.*\.slaks.net/ },
  },
  plugins: [
    hmrPlugin({
      include: ["./src/**/*.ts"],
      presets: [presets.lit],
    }),
  ],
});
