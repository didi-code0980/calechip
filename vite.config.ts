import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { orderAvatarFiles } from "./src/lib/avatars";

// SOLO, 2026-09-13. **THE AVATAR LIST IS THE CONTENTS OF `public/images/`, READ WHEN THE APP IS
// BUILT OR THE DEV SERVER STARTS**, and served to the code as `virtual:avatar-images` — a default
// export of file names, filtered and ordered by `src/lib/avatars.ts`.
//
// Why a plugin and not `import.meta.glob`: files in `public/` are copied as-is and are not
// importable. Vite 8.2.2 warns *"Assets in public directory cannot be imported from JavaScript"*
// (`node_modules/vite/dist/node/chunks/node.js:25276`), and a glob over them would also emit a
// second, hashed copy of every image into the build. A static host cannot list a folder at runtime
// either. The cost of reading at build time: an image added to the folder appears after the next
// build, or immediately under `pnpm dev`, which reloads the page when the folder changes.
//
// Vitest reads this same config, so the unit tests see the same list the build does.
const AVATAR_MODULE = "virtual:avatar-images";
const RESOLVED_AVATAR_MODULE = `\0${AVATAR_MODULE}`;
const AVATAR_DIR = fileURLToPath(new URL("./public/images", import.meta.url));

function readAvatarFiles(): string[] {
  try {
    return orderAvatarFiles(
      readdirSync(AVATAR_DIR, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name),
    );
  } catch {
    // No folder is the same as an empty folder: every avatar renders the default placeholder and
    // sign-up falls back to `DEFAULT_AVATAR`. It never fails the build.
    return [];
  }
}

function avatarImages(): Plugin {
  return {
    name: "calechip-avatar-images",
    resolveId(id) {
      return id === AVATAR_MODULE ? RESOLVED_AVATAR_MODULE : undefined;
    },
    load(id) {
      return id === RESOLVED_AVATAR_MODULE
        ? `export default ${JSON.stringify(readAvatarFiles())};`
        : undefined;
    },
    configureServer(server) {
      server.watcher.add(AVATAR_DIR);
      const onFolderChange = (file: string) => {
        if (path.dirname(path.resolve(file)) !== AVATAR_DIR) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_AVATAR_MODULE);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", onFolderChange);
      server.watcher.on("unlink", onFolderChange);
    },
  };
}

// `defineConfig` comes from vitest/config, not from vite. Vite's own export does not carry the
// `test` key, and vitest 4 was verified against the installed package rather than recalled —
// see "Versions the model cannot recall" in .ai/standards/tech-stack.md.
export default defineConfig({
  plugins: [react(), tailwindcss(), avatarImages()],
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
