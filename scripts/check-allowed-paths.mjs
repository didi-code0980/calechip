// check-allowed-paths.mjs — CI enforcement of RULE-03.
//
// This duplicates review check R1 deliberately. R1 runs inside the review agent's own session, where
// the agent both performs the check and reports the result. This runs in CI, where it can neither be
// skipped nor misreported. A control that the controlled party administers is not a control.
//
// Exits 0 on any non-feat/ branch: bootstrap and chore work has no ticket.
//
// Since ADR-023 it also exempts the ship-owned set below, so that a ship is one pull request.
//
// Run: node scripts/check-allowed-paths.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = process.env.GITHUB_BASE_REF || "main";

// The ship-owned set — ADR-023. These are the only three files `/ship` writes outside any ticket's
// allowed_paths, and since ADR-023 it carries them on the ticket branch so that a ship produces one
// pull request instead of two that have to be merged together or not at all.
//
// The list is fixed and closed on purpose. A fourth path is an edit to this array plus an ADR, never
// a judgement made at ship time — the moment the exemption becomes a category rather than three
// names, RULE-03 stops being enforceable in CI, which is the whole reason this file exists.
const SHIP_OWNED = [".ai/board/backlog.md", ".ai/board/metrics.md", ".ai/registry/features.md"];

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function branchName() {
  // On a pull_request event GitHub checks out a detached merge commit, so HEAD is not the branch.
  if (process.env.GITHUB_HEAD_REF) return process.env.GITHUB_HEAD_REF;
  const ref = process.env.GITHUB_REF;
  if (ref && ref.startsWith("refs/heads/")) return ref.slice("refs/heads/".length);
  try {
    const b = git(["rev-parse", "--abbrev-ref", "HEAD"]);
    return b === "HEAD" ? null : b;
  } catch {
    return null;
  }
}

function readYamlList(text, key) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = new RegExp(`^${key}:\\s*(.*)$`).exec(lines[i]);
    if (!m) continue;
    const inline = m[1].trim();
    if (inline.startsWith("[")) {
      return inline
        .slice(1, inline.lastIndexOf("]"))
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
    const out = [];
    for (let j = i + 1; j < lines.length; j++) {
      const item = /^\s*-\s*(.+?)\s*$/.exec(lines[j]);
      if (!item) {
        if (/^\s*$|^\s*#/.test(lines[j])) continue;
        break;
      }
      out.push(item[1].replace(/^["']|["']$/g, ""));
    }
    return out;
  }
  return null;
}

function globToRegExp(glob) {
  let g = glob.trim();
  if (g.endsWith("/")) g += "**";
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        if (g[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

const branch = branchName();
if (!branch || !branch.startsWith("feat/")) {
  console.log(`allowed-paths: branch "${branch ?? "detached"}" is not feat/*, nothing to check`);
  process.exit(0);
}

const ticketId = branch.slice("feat/".length).split("/")[0];
const ticketDir = `.ai/board/tickets/${ticketId}`;
const ticketFile = path.join(ROOT, ticketDir, "ticket.yaml");

if (!fs.existsSync(ticketFile)) {
  console.error(`allowed-paths: FAIL — branch ${branch} names ticket ${ticketId}, but ${ticketDir}/ticket.yaml does not exist`);
  process.exit(1);
}

const allowed = readYamlList(fs.readFileSync(ticketFile, "utf8"), "allowed_paths");
if (allowed === null) {
  console.error(`allowed-paths: FAIL — ${ticketDir}/ticket.yaml has no allowed_paths key`);
  process.exit(1);
}

let changed = [];
try {
  try {
    git(["rev-parse", "--verify", `origin/${BASE}`]);
  } catch {
    execFileSync("git", ["fetch", "--no-tags", "--depth=50", "origin", BASE], { cwd: ROOT });
  }
  changed = git(["diff", "--name-only", `origin/${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean);
} catch (err) {
  console.error(`allowed-paths: FAIL — could not compute the diff against origin/${BASE}: ${err.message}`);
  process.exit(1);
}

const matchers = allowed.map(globToRegExp);
const violations = changed.filter((f) => {
  if (f === ticketDir || f.startsWith(`${ticketDir}/`)) return false;
  if (SHIP_OWNED.includes(f)) return false;
  return !matchers.some((re) => re.test(f));
});

console.log(`allowed-paths: ticket ${ticketId}, ${changed.length} changed file(s)`);
console.log(`allowed_paths: ${allowed.length ? allowed.join(", ") : "(empty)"}`);

if (violations.length) {
  console.error("allowed-paths: FAIL — files outside allowed_paths (RULE-03):");
  console.error(`  (exempt: the ticket folder, and the ship-owned set ${SHIP_OWNED.join(", ")})`);
  for (const v of violations) console.error(`  - ${v}`);
  if (allowed.length === 0) {
    console.error("  allowed_paths is empty, which means DESIGN has not enumerated it yet.");
  }
  process.exit(1);
}

console.log("allowed-paths: PASS");
