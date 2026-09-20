// scripts/run-loop.mjs — the unattended loop runner (ADR-036).
//
// **What these tests are for.** The runner's whole claim is that routing is deterministic code and
// never a model call, so the routing is the thing that has to be tested. Spawning `claude` is not:
// `invoke` and `git` are deliberately not exported, because a test that can call them is a test
// that can start a paid session by accident.
//
// Two of these assertions exist because of a specific defect rather than for coverage:
//   - `invariant_violation` stops the run *before* the router is consulted. RULE-07 escalates on
//     first occurrence and never enters REWORK. Until ADR-036 the review verdict named a check
//     number, the number disagreed across four files, and the number that meant "invariant" in the
//     template was the number the routing table sent to `developer` with the counter incrementing.
//   - `tech-lead-review` gets a new session id every time, under every entry path. RULE-13 is the
//     only independent check the loop has, and a resumed reviewer is the first pass agreeing with
//     itself.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  nextStep, advanceSimulated, sessionFor, reviewStop, questionStop, budgetStop,
  inAllowedPaths, validateEntry, buildArgv, parseArgv, SESSION_POLICY, TICKET_ID,
} from "../run-loop.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "run-loop.mjs");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "run-loop-"));

const ticket = (over = {}) => ({
  id: "TST-01", state: "BACKLOG", feature_ids: ["TST-01"], depends_on: [],
  allowed_paths: [], rework_count: 0, gates: { plan: {}, review: {} }, ...over,
});

const writeReview = (dir, fm) => {
  const body = Object.entries(fm).map(([k, v]) =>
    `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : v}`).join("\n");
  fs.writeFileSync(path.join(dir, "04-review.md"), `---\n${body}\n---\n\n# Review\n`);
};

// --- Routing ------------------------------------------------------------------------------------

test("each entry state starts at the right stage, with the right agent", () => {
  const dir = tmp();
  assert.deepEqual(
    nextStep(ticket({ state: "BACKLOG" }), dir),
    { command: "/plan", agent: "tech-lead-design", then: "/advance" });
  assert.deepEqual(
    nextStep(ticket({ state: "READY" }), dir),
    { command: "/implement", agent: "developer", then: "/advance" });
  assert.deepEqual(
    nextStep(ticket({ state: "REVIEW" }), dir),
    { command: "/review", agent: "tech-lead-review", then: "/advance" });
});

test("a REVIEW whose review gate already passed goes to /ship, not round again", () => {
  const t = ticket({ state: "REVIEW", gates: { review: { passed: true } } });
  assert.deepEqual(nextStep(t, tmp()), { command: "/ship", agent: "orchestrator" });
});

test("REWORK routes on route_to, never on a check number", () => {
  const a = tmp();
  writeReview(a, { gate: "FAIL", verdict: "FAIL", route_to: "developer", invariant_violation: false });
  assert.equal(nextStep(ticket({ state: "REWORK" }), a).agent, "developer");

  const b = tmp();
  writeReview(b, { gate: "FAIL", verdict: "FAIL", route_to: "tech-lead-design", invariant_violation: false });
  assert.equal(nextStep(ticket({ state: "REWORK" }), b).agent, "tech-lead-design");
});

test("REWORK with no review artifact stops rather than guessing a route", () => {
  const step = nextStep(ticket({ state: "REWORK" }), tmp());
  assert.match(step.stop, /no 04-review\.md/);
});

test("the dry-run walk reaches /ship from every entry state", () => {
  const dir = tmp();
  for (const start of ["BACKLOG", "READY", "REVIEW"]) {
    let t = ticket({ state: start });
    const seen = [];
    for (let i = 0; i < 8 && t; i++) {
      const step = nextStep(t, dir);
      assert.ok(!step.stop, `unexpected stop from ${start}: ${step.stop}`);
      seen.push(step.command);
      t = advanceSimulated(t);
    }
    assert.equal(seen.at(-1), "/ship", `sequence from ${start} did not end at /ship: ${seen.join(" ")}`);
  }
});

// --- RULE-07: an invariant violation must never reach the developer ------------------------------

test("invariant_violation stops the run before the router is consulted", () => {
  const dir = tmp();
  writeReview(dir, {
    gate: "FAIL", verdict: "FAIL", invariant_violation: true,
    route_to: "human", increments_rework: false, blocking_reason: "INV-03 not held",
  });
  const t = ticket({ state: "REWORK" });

  const stop = reviewStop(t, dir);
  assert.ok(stop, "reviewStop must halt on an invariant violation");
  assert.match(stop, /RULE-07/);
  assert.match(stop, /INV-03/);
});

test("route_to: human and a BLOCKED verdict both stop", () => {
  const a = tmp();
  writeReview(a, { gate: "FAIL", verdict: "FAIL", invariant_violation: false, route_to: "human" });
  assert.match(reviewStop(ticket(), a), /routed to a human/);

  const b = tmp();
  writeReview(b, { gate: "BLOCKED", verdict: "BLOCKED", invariant_violation: false, route_to: "none" });
  assert.match(reviewStop(ticket(), b), /BLOCKED/);
});

test("a verdict that disagrees with its own gate voids the artifact", () => {
  const dir = tmp();
  writeReview(dir, { gate: "PASS", verdict: "FAIL", invariant_violation: false, route_to: "none" });
  assert.match(reviewStop(ticket(), dir), /void/);
});

test("a clean PASS does not stop the run", () => {
  const dir = tmp();
  writeReview(dir, { gate: "PASS", verdict: "PASS", invariant_violation: false, route_to: "none" });
  assert.equal(reviewStop(ticket(), dir), null);
});

// --- The other stop conditions -------------------------------------------------------------------

test("a question addressed to a person halts the run", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "99-questions.md"), "---\nto: operator\nasked_at: x\n---\n");
  assert.match(questionStop(ticket(), dir), /operator/);

  const other = tmp();
  fs.writeFileSync(path.join(other, "99-questions.md"), "---\nto: tech-lead-design\nasked_at: x\n---\n");
  assert.equal(questionStop(ticket(), other), null);
});

test("an exhausted chat budget halts the run (RULE-15)", () => {
  const t = ticket({ chat_budget: { "developer->tech-lead-design": { used: 6, max: 6 } } });
  assert.match(budgetStop(t), /chat budget exhausted/);
  const ok = ticket({ chat_budget: { "developer->tech-lead-design": { used: 2, max: 6 } } });
  assert.equal(budgetStop(ok), null);
});

// --- RULE-13: the reviewer never resumes ---------------------------------------------------------

test("a second review of the same ticket uses a different session id", () => {
  const store = {};
  const first = sessionFor("tech-lead-review", "TST-01", store);
  const second = sessionFor("tech-lead-review", "TST-01", store);
  assert.notEqual(first.sessionId, second.sessionId);
  assert.equal(first.mode, "new");
  assert.equal(second.mode, "new", "a reviewer must never resume — RULE-13");
});

test("the developer resumes across REWORK and is discarded per ticket", () => {
  const store = {};
  const first = sessionFor("developer", "TST-01", store);
  const second = sessionFor("developer", "TST-01", store);
  assert.equal(first.sessionId, second.sessionId);
  assert.equal(second.mode, "resume");

  const otherTicket = sessionFor("developer", "TST-02", store);
  assert.notEqual(otherTicket.sessionId, first.sessionId);
});

test("orchestrator and tech-lead-design persist across tickets", () => {
  const store = {};
  for (const agent of ["orchestrator", "tech-lead-design"]) {
    const a = sessionFor(agent, "TST-01", store);
    const b = sessionFor(agent, "TST-02", store);
    assert.equal(a.sessionId, b.sessionId, `${agent} must be one persistent session`);
    assert.equal(b.mode, "resume");
  }
});

test("every agent the router can name has a session policy", () => {
  for (const agent of ["tech-lead-design", "developer", "tech-lead-review", "orchestrator"]) {
    assert.ok(SESSION_POLICY[agent], `${agent} has no session policy`);
  }
  assert.equal(SESSION_POLICY["tech-lead-review"], "always-fresh");
});

// --- Invocation shape ----------------------------------------------------------------------------

test("the argv never drops the project's hooks, commands or agents", () => {
  const argv = buildArgv("/review TST-01", "tech-lead-review", { sessionId: "u", mode: "new" });
  assert.ok(!argv.includes("--bare"), "--bare skips hooks and CLAUDE.md and must never be passed");
  assert.deepEqual(argv.slice(argv.indexOf("--setting-sources"), argv.indexOf("--setting-sources") + 2),
                   ["--setting-sources", "user,project,local"]);
  assert.ok(argv.includes("--agent") && argv.includes("tech-lead-review"));
  assert.ok(argv.includes("--session-id"), "a new session is created with --session-id");
  assert.ok(!argv.includes("--resume"));
});

test("a resumed session uses --resume and never --session-id", () => {
  const argv = buildArgv("/implement TST-01", "developer", { sessionId: "u", mode: "resume" });
  assert.ok(argv.includes("--resume"));
  assert.ok(!argv.includes("--session-id"));
});

// --- Spawning ---------------------------------------------------------------------------------------

test("no argument the runner passes survives a shell intact, so no shell is used", () => {
  // This test exists because of a real failure, not a hypothetical one. On Windows `claude` on PATH
  // is a .cmd shim, so the first version spawned with shell: true. The shell then split
  // `--setting-sources user,project,local` into three words, and the CLI reported "Invalid setting
  // source: user project local" — which reads as a CLI bug rather than a quoting one.
  const argv = buildArgv("/review TST-01", "tech-lead-review", { sessionId: "u", mode: "new" });
  const risky = argv.filter((a) => /[,s"&|<>^()]/.test(a));
  assert.ok(risky.length > 0, "if nothing is shell-sensitive this test has stopped measuring anything");

  const src = fs.readFileSync(SCRIPT, "utf8");
  assert.match(src, /shell: false/, "the runner must spawn without a shell");
  assert.ok(!/shell: process.platform/.test(src), "shell must not be conditional on the platform");
});

test("the argv is a list, never a joined command line", () => {
  const argv = buildArgv("/plan TST-01", "tech-lead-design", { sessionId: "u", mode: "new" });
  assert.ok(Array.isArray(argv));
  assert.ok(argv.includes("user,project,local"),
    "the comma-separated value must be ONE argv element; a shell would split it");
});

// --- Entry validation ----------------------------------------------------------------------------

test("entry validation refuses the states a human owns", () => {
  assert.match(validateEntry(ticket({ state: "ESCALATED" })).join(" "), /a human decides/);
  assert.match(validateEntry(ticket({ state: "DONE" })).join(" "), /DONE/);
});

test("entry validation names the missing DoR item rather than filling it", () => {
  assert.match(validateEntry(ticket({ feature_ids: [] })).join(" "), /Definition of Ready item 1/);
});

// --- Globs and ids -------------------------------------------------------------------------------

test("allowed_paths globs match the way check-allowed-paths does", () => {
  assert.ok(inAllowedPaths("src/routes/Year.tsx", ["src/routes/**"]));
  assert.ok(inAllowedPaths("src/lib/data/absence.ts", ["src/lib/data/*.ts"]));
  assert.ok(!inAllowedPaths("src/lib/data/sub/x.ts", ["src/lib/data/*.ts"]));
  assert.ok(!inAllowedPaths("MODEL-OVERVIEW.md", ["src/**"]));
});

test("the ticket id pattern accepts real ids and rejects prose", () => {
  for (const id of ["CAL-10", "UIE-02", "OPS-002", "TEA-01", "CAL-10a"]) {
    assert.ok(TICKET_ID.test(id), `${id} should be a ticket id`);
  }
  for (const s of ["add a dark mode", "the year view is slow", "https://app.clickup.com/t/abc"]) {
    assert.ok(!TICKET_ID.test(s), `${s} must not be read as a ticket id`);
  }
});

// --- CLI ------------------------------------------------------------------------------------------

const runCli = (args) => {
  try {
    return { status: 0, out: execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" }) };
  } catch (e) {
    return { status: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

test("a non-existent ticket id errors and invokes nothing", () => {
  const r = runCli(["auto", "ZZZ-99", "--dry-run"]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /no ticket\.yaml/);
});

test("free text enters through intake and triage, and prints the whole sequence", () => {
  // Stage A refused this outright; ADR-037 installed the resolver. The assertion that free text is
  // never mistaken for a ticket now lives in entry.test.mjs, against the resolver itself.
  const r = runCli(["auto", "add a dark mode toggle", "--dry-run"]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /resolved as free text/);
  assert.match(r.out, /intake/);
  assert.match(r.out, /\/triage/);
  assert.match(r.out, /REJECT \| NEEDS-ADR -> stop/);
  assert.match(r.out, /\/ship/);
});

test("--until only accepts a real state", () => {
  const r = runCli(["auto", "CAL-10", "--until", "NOPE", "--dry-run"]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /is not a state/);
});

test("parseArgv defaults and flags", () => {
  const o = parseArgv(["auto", "CAL-10", "--dry-run", "--max-steps", "3"]);
  assert.equal(o.command, "auto");
  assert.equal(o.input, "CAL-10");
  assert.equal(o.dryRun, true);
  assert.equal(o.maxSteps, 3);
});

// --- No new dependencies (review check R8) ---------------------------------------------------------

test("the runner imports node built-ins and repository files only", () => {
  for (const f of [SCRIPT, path.join(path.dirname(SCRIPT), "lib", "ticket-yaml.mjs")]) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/^import .*? from "([^"]+)";/gm)) {
      const spec = m[1];
      assert.ok(spec.startsWith("node:") || spec.startsWith("./") || spec.startsWith("../"),
        `${path.basename(f)} imports \`${spec}\` — a dependency needs an ADR (R8)`);
    }
  }
});
