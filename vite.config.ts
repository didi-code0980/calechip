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
  // `pnpm dev` serves on http://localhost:4000, and Vite's default of 5173 is not used.
  //
  // `strictPort` so a busy 4000 is an ERROR rather than a silent move to 4001. Without it Vite
  // increments until it finds a free port and prints the new one, which is the failure mode this
  // setting exists to prevent: the request was for a fixed address, and an address that quietly
  // changes is worse than one that refuses.
  //
  // THE END-TO-END SUITE IS NOT AFFECTED. `playwright.config.ts` builds and runs `vite preview
  // --port 4173 --strictPort` against `baseURL: "http://localhost:4173"` — the PREVIEW server, which
  // takes its port from that flag and never from this block. Changing one does not move the other.
  server: {
    port: 4000,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
