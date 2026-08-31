import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// `defineConfig` comes from vitest/config, not from vite. Vite's own export does not carry the
// `test` key, and vitest 4 was verified against the installed package rather than recalled —
// see "Versions the model cannot recall" in .ai/standards/tech-stack.md.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
