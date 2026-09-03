// The half of § Language that a lint rule cannot express.
//
// `eslint.config.js` enforces the positive requirement: no Vietnamese diacritic in interface copy
// under `src/`. It cannot enforce the negative one — that `src/lib/fixtures.ts` and
// `supabase/seed.sql` MUST still contain diacritics — because a lint rule reports what is present
// and is silent about what is missing.
//
// That silence is the whole risk. `.ai/standards/ui-design-system.md` § Language predicts the exact
// failure in advance: translate `displayName: "Thành viên"` to `"Member"` and nothing anywhere
// renders a diacritic, so the next font change breaks the real names of real people and every test
// still passes. `src/routes/Home.tsx` and `supabase/seed.sql` hold that identical literal with
// opposite verdicts — one is interface copy and must go, one is user content and must stay — and
// `tests/e2e/tea-05-sign-in.spec.ts` asserts both, two lines apart. A find-and-replace takes both.
//
// This file is what fails when that happens.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import uiLanguage from "../ui-language.json";

const { copyDebt, userContent, diacritic: pattern } = uiLanguage;

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const diacritic = new RegExp(pattern);
const read = (path: string): string => readFileSync(repoRoot + path, "utf8");
const each = (paths: readonly string[]): Array<[string]> => paths.map((path) => [path]);

describe("§ Language — the exception is alive", () => {
  // If either of these fails, the diacritics were translated away and the product has lost its only
  // coverage for the type requirement in CLAUDE.md § Visual direction. The fix is to restore the
  // Vietnamese names, never to relax this test.
  it.each(each(userContent))("%s still contains Vietnamese diacritics", (path) => {
    expect(existsSync(repoRoot + path), `${path} is gone — the exception has no home`).toBe(true);
    expect(diacritic.test(read(path))).toBe(true);
  });

  it("does not list a user-content file as copy debt", () => {
    // The two lists mean opposite things. A file in both would be translated by OPS-001 or OPS-002
    // and would take the exception with it.
    expect(copyDebt.filter((path) => userContent.includes(path))).toEqual([]);
  });
});

describe("§ Language — the ratchet only shrinks", () => {
  it.each(each(copyDebt))("%s still exists", (path) => {
    // A stale entry silences the rule for a path nothing occupies, and the next file created at that
    // name inherits the exemption without anyone deciding to grant it.
    expect(existsSync(repoRoot + path)).toBe(true);
  });

  it.each(each(copyDebt))("%s still has copy to translate", (path) => {
    // The self-cleaning half, and the reason this list is a better record than a ticket marked DONE:
    // once OPS-001 or OPS-002 translates a file, this fails until the entry is removed from
    // `copyDebt` — so the list cannot claim a debt that is already paid, and the sweep is complete
    // exactly when the list is empty rather than when somebody says it is.
    expect(diacritic.test(read(path))).toBe(true);
  });
});
