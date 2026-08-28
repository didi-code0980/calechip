// RULE-03 — an agent may not edit any file outside the active ticket's allowed_paths.

import test from "node:test";
import assert from "node:assert/strict";
import { makeProject, runHook, runHookRaw, detachedHead, TICKET } from "./_harness.mjs";

const HOOK = "guard-allowed-paths.mjs";
const write = (file_path) => ({ tool_name: "Write", tool_input: { file_path, content: "x" } });
const TICKET_FILE = ".ai/board/tickets/TST-01/ticket.yaml";

test("allows everything on a non-feat branch", () => {
  const root = makeProject({}, "main");
  assert.equal(runHook(HOOK, root, write("src/anything.ts")).code, 0);
});

test("allows everything on a chore branch", () => {
  const root = makeProject({}, "ops/bootstrap");
  assert.equal(runHook(HOOK, root, write("src/anything.ts")).code, 0);
});

test("allows a detached HEAD", () => {
  const root = makeProject({}, "main");
  detachedHead(root);
  assert.equal(runHook(HOOK, root, write("src/anything.ts")).code, 0);
});

test("empty allowed_paths blocks src", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET() }, "feat/TST-01");
  const r = runHook(HOOK, root, write("src/anything.ts"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /allowed_paths is empty/);
  assert.match(r.stderr, /RULE-03/);
});

test("empty allowed_paths blocks everything outside the ticket folder, not only src", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET() }, "feat/TST-01");
  assert.equal(runHook(HOOK, root, write("tests/e2e/smoke.spec.ts")).code, 2);
});

test("the ticket folder stays writable while allowed_paths is empty", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET() }, "feat/TST-01");
  const r = runHook(HOOK, root, write(".ai/board/tickets/TST-01/03-impl-log.md"));
  assert.equal(r.code, 0, "stage artifacts must be writable before DESIGN enumerates paths");
});

test("allows a path inside allowed_paths", () => {
  const root = makeProject(
    { [TICKET_FILE]: TICKET({ allowed_paths: '["src/app/orders/**", "src/lib/data/mock/orders.ts"]' }) },
    "feat/TST-01"
  );
  assert.equal(runHook(HOOK, root, write("src/app/orders/page.tsx")).code, 0);
  assert.equal(runHook(HOOK, root, write("src/lib/data/mock/orders.ts")).code, 0);
});

test("blocks a sibling path that the glob does not cover", () => {
  const root = makeProject(
    { [TICKET_FILE]: TICKET({ allowed_paths: '["src/app/orders/**"]' }) },
    "feat/TST-01"
  );
  const r = runHook(HOOK, root, write("src/app/invoices/page.tsx"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /not in ticket TST-01 allowed_paths/);
});

test("single star does not cross a directory boundary", () => {
  const root = makeProject(
    { [TICKET_FILE]: TICKET({ allowed_paths: '["src/app/*.tsx"]' }) },
    "feat/TST-01"
  );
  assert.equal(runHook(HOOK, root, write("src/app/page.tsx")).code, 0);
  assert.equal(runHook(HOOK, root, write("src/app/orders/page.tsx")).code, 2);
});

test("block-sequence allowed_paths parses", () => {
  const yaml = TICKET().replace("allowed_paths: []", "allowed_paths:\n  - src/app/orders/**");
  const root = makeProject({ [TICKET_FILE]: yaml }, "feat/TST-01");
  assert.equal(runHook(HOOK, root, write("src/app/orders/page.tsx")).code, 0);
  assert.equal(runHook(HOOK, root, write("src/app/invoices/page.tsx")).code, 2);
});

test("blocks a write that escapes the repository", () => {
  const root = makeProject(
    { [TICKET_FILE]: TICKET({ allowed_paths: '["src/**"]' }) },
    "feat/TST-01"
  );
  const r = runHook(HOOK, root, write("../outside.ts"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /outside the repository/);
});

test("fails closed when the branch names a ticket that does not exist", () => {
  const root = makeProject({}, "feat/TST-99");
  const r = runHook(HOOK, root, write("src/anything.ts"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /failing closed/);
});

test("fails closed on unparseable stdin", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET() }, "feat/TST-01");
  assert.equal(runHookRaw(HOOK, root, "{oops").code, 2);
});
