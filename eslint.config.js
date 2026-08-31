// Flat config, ESLint 10. Verified against the installed packages rather than recalled — ESLint
// resolved to 10.x, not the 9 named when the stack was chosen, and the two do not share a config
// surface. See "Versions the model cannot recall" in .ai/standards/tech-stack.md.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * RULE-02 lives here.
 *
 * `.ai/standards/architecture.md` declares `src/lib/data/` as the data-access seam and says nothing
 * outside it may import the Supabase client. That sentence is unenforceable as prose, so this is the
 * mechanism: an import of `@supabase/*` from anywhere under `src/` other than the seam is an error,
 * and `pnpm lint` is in the Definition of Done.
 *
 * The same boundary is declared again in `.ai/registry/boundaries.json` and checked by D12, which
 * reports a crossing even if this rule is later loosened.
 */
const SEAM = "src/lib/data";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "_figma/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The hooks, the audit and their tests are Node programs, not browser code. They are linted —
    // a guard with a syntax error fails open and silently — but under Node globals.
    files: ["scripts/**/*.mjs", ".claude/hooks/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [`${SEAM}/**`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "@supabase/**"],
              message:
                "RULE-02: the Supabase client may only be imported inside src/lib/data/, the " +
                "data-access seam declared in .ai/standards/architecture.md. Reach the datastore " +
                "through the seam.",
            },
          ],
        },
      ],
    },
  },
);
