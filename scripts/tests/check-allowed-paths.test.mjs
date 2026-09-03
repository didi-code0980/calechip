// RULE-03 in CI — scripts/check-allowed-paths.mjs, the live mechanism since ADR-004 unwired the
// hook. These tests exist because ADR-023 widened it: the ship-owned set now passes on a ticket
// branch so that a ship is one pull request. A widening needs tests in both directions, or the next
// reader cannot tell an exemption from a hole.
//
// Unlike the hook tests, these build a real git repository — the script's whole judgement is a diff
// of origin/<base>...HEAD, so a fake .git/HEAD would test nothing.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "check-allowed-paths.mjs"
);

const TICKET = (allowed) =>
  [
    "id: TST-01",
    'title: ""',
    "feature_ids: []",
    "state: REVIEW",
    "invariants_touched: []",
    `allowed_paths: ${allowed}`,
    "schema_delta: none",
    "rework_count: 0",
    "",
  ].join("\n");

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  }).trim();
}

function writeFile(root, rel, contents) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

// A repository whose main already carries the ticket shell, with origin/main pointing at it, then a
// feat/TST-01 branch carrying `files`. Returns the repo root.
function makeRepo(allowedPaths, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cap-"));
  git(root, ["init", "--quiet", "-b", "main"]);
  writeFile(root, ".ai/board/tickets/TST-01/ticket.yaml", TICKET(allowedPaths));
  writeFile(root, ".ai/board/backlog.md", "backlog\n");
  writeFile(root, ".ai/board/metrics.md", "metrics\n");
  writeFile(root, ".ai/registry/features.md", "features\n");
  writeFile(root, "src/app/orders/page.tsx", "before\n");
  writeFile(root, "src/app/invoices/page.tsx", "before\n");
  git(root, ["add", "-A"]);
  git(root, ["commit", "--quiet", "-m", "base"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  git(root, ["switch", "--quiet", "-c", "feat/TST-01"]);
  for (const [rel, contents] of Object.entries(files)) writeFile(root, rel, contents);
  git(root, ["add", "-A"]);
  git(root, ["commit", "--quiet", "-m", "ship"]);
  return root;
}

// The script reads GITHUB_HEAD_REF/GITHUB_REF before it reads the branch, so a test run inside CI
// would otherwise judge the wrong branch. Strip both.
function run(root) {
  const env = { ...process.env };
  delete env.GITHUB_HEAD_REF;
  delete env.GITHUB_REF;
  delete env.GITHUB_BASE_REF;
  const res = execFileSync("node", [SCRIPT], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  return { code: 0, stdout: res };
}

function runExpectingFail(root) {
  try {
    run(root);
    return null;
  } catch (err) {
    return { code: err.status, stderr: err.stderr ?? "", stdout: err.stdout ?? "" };
  }
}

test("a diff inside allowed_paths passes", () => {
  const root = makeRepo('["src/app/orders/**"]', { "src/app/orders/page.tsx": "after\n" });
  assert.match(run(root).stdout, /allowed-paths: PASS/);
});

test("a path outside allowed_paths still fails", () => {
  const root = makeRepo('["src/app/orders/**"]', { "src/app/invoices/page.tsx": "after\n" });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /src\/app\/invoices\/page\.tsx/);
  assert.match(r.stderr, /RULE-03/);
});

test("the ticket's own folder is exempt", () => {
  const root = makeRepo('["src/app/orders/**"]', {
    ".ai/board/tickets/TST-01/04-review.md": "verdict\n",
  });
  assert.match(run(root).stdout, /allowed-paths: PASS/);
});

// ADR-023, the widening.
test("the ship-owned set passes on a ticket branch", () => {
  const root = makeRepo('["src/app/orders/**"]', {
    "src/app/orders/page.tsx": "after\n",
    ".ai/board/backlog.md": "moved to archive\n",
    ".ai/board/metrics.md": "one more row\n",
    ".ai/registry/features.md": "TST-01 DONE\n",
  });
  assert.match(
    run(root).stdout,
    /allowed-paths: PASS/,
    "a ship must be one branch: backlog, metrics and features ride with the ticket"
  );
});

// ADR-023, the other direction — the exemption is three names, not a category.
test("another .ai/board/ path is still a violation", () => {
  const root = makeRepo('["src/app/orders/**"]', { ".ai/board/model-debt.md": "MD-099\n" });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /model-debt\.md/);
});

test("another .ai/registry/ path is still a violation", () => {
  const root = makeRepo('["src/app/orders/**"]', { ".ai/registry/rules.md": "RULE-19\n" });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /rules\.md/);
});

test("a ticket folder that is not this ticket's is still a violation", () => {
  const root = makeRepo('["src/app/orders/**"]', {
    ".ai/board/tickets/TST-02/01-plan.md": "other ticket\n",
  });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /TST-02/);
});

test("the ship-owned set does not rescue an empty allowed_paths for source files", () => {
  const root = makeRepo("[]", {
    ".ai/board/metrics.md": "one more row\n",
    "src/app/orders/page.tsx": "after\n",
  });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /src\/app\/orders\/page\.tsx/);
});

test("a non-feat branch is not checked at all", () => {
  const root = makeRepo("[]", { "src/app/orders/page.tsx": "after\n" });
  git(root, ["switch", "--quiet", "-c", "ops/model-change"]);
  assert.match(run(root).stdout, /is not feat\/\*/);
});
