// Tests for scripts/init-project.mjs.
//
// Every test runs against a throwaway copy of the whole kit rather than against a fixture, because
// what is being tested is that the script's anchors still match the real files. A fixture would keep
// passing on the day somebody rewords the CLAUDE.md heading, which is the one failure the script
// exists to make loud.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const temps = [];
process.on("exit", () => {
  for (const d of temps) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      // A locked file on Windows must not turn a passing suite red.
    }
  }
});

function freshKit() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aifw-init-"));
  fs.cpSync(KIT, dir, {
    recursive: true,
    filter: (src) => {
      const r = path.relative(KIT, src);
      return !r.split(path.sep).some((seg) => seg === "node_modules" || seg === ".git");
    },
  });
  temps.push(dir);
  return dir;
}

function init(root, args) {
  const res = spawnSync(process.execPath, [path.join(root, "scripts/init-project.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
  });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function audit(root) {
  const res = spawnSync(process.execPath, [path.join(root, "scripts/check-docs.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");

const OK = ["--name", "Order Desk", "--owner", "@acme/platform"];

describe("init-project — arguments", () => {
  test("--help exits 0 and prints the usage", () => {
    const r = init(freshKit(), ["--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /--prefixes/);
  });

  test("a missing --owner is refused", () => {
    const r = init(freshKit(), ["--name", "Order Desk"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--owner is required/);
  });

  test("an --owner without @ is refused", () => {
    const r = init(freshKit(), ["--name", "X", "--owner", "acme"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /must start with @/);
  });

  test("a prefix with no expansion is refused", () => {
    const r = init(freshKit(), [...OK, "--prefixes", "ORD"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /has no expansion/);
  });

  test("a prefix that is not three letters is refused", () => {
    const r = init(freshKit(), [...OK, "--prefixes", "ORDER=Orders"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /three uppercase letters/);
  });

  // The kit's own worked examples all cite EXA-01 and D1 exempts only .ai/templates/ and
  // features.md, so a project that claimed EXA would fail D1 on a dozen files it never wrote.
  test("the reserved example prefix is refused", () => {
    const r = init(freshKit(), [...OK, "--prefixes", "EXA=Examples"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /reserved/);
  });
});

describe("init-project — stamping", () => {
  test("--dry-run writes nothing", () => {
    const root = freshKit();
    const before = read(root, "CLAUDE.md");
    const r = init(root, [...OK, "--dry-run"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /would write/);
    assert.match(r.stdout, /Dry run/);
    assert.equal(read(root, "CLAUDE.md"), before);
  });

  test("the four mechanical placeholders are stamped", () => {
    const root = freshKit();
    const r = init(root, OK);
    assert.equal(r.status, 0, r.stderr);

    assert.match(read(root, "CLAUDE.md"), /^# Order Desk$/m);
    assert.doesNotMatch(read(root, "CLAUDE.md"), /TODO\(project\): the product name/);

    const owners = read(root, ".github/CODEOWNERS");
    assert.doesNotMatch(owners, /@OWNER/);
    assert.match(owners, /\/\.ai\/registry\/\s+@acme\/platform/);

    assert.equal(JSON.parse(read(root, "package.json")).name, "order-desk");
  });

  test("--slug overrides the derived package name", () => {
    const root = freshKit();
    assert.equal(init(root, [...OK, "--slug", "desk"]).status, 0);
    assert.equal(JSON.parse(read(root, "package.json")).name, "desk");
  });

  // Without --prefixes the registry is not touched at all. RULE-01 makes that the default.
  test("the registry is untouched when --prefixes is absent", () => {
    const root = freshKit();
    const before = read(root, ".ai/registry/features.md");
    assert.equal(init(root, OK).status, 0);
    assert.equal(read(root, ".ai/registry/features.md"), before);
  });

  test("--prefixes fills the line D1 reads and one empty section per prefix", () => {
    const root = freshKit();
    const r = init(root, [...OK, "--prefixes", "ORD=Orders,PAY=Payments"]);
    assert.equal(r.status, 0, r.stderr);

    const feat = read(root, ".ai/registry/features.md");
    assert.match(feat, /<!-- id-prefixes: ORD PAY -->/);
    assert.match(feat, /^## ORD — Orders$/m);
    assert.match(feat, /^## PAY — Payments$/m);
    assert.doesNotMatch(feat, /TODO\(project\): group sections go here/);
    // Sections ship with the column header and no rows. Rows are a human decision, one at a time.
    assert.doesNotMatch(feat, /\|\s*ORD-\d{2}\s*\|/);

    assert.match(r.stdout, /RULE-01/);
  });

  test("the remaining marker count is reported", () => {
    const r = init(freshKit(), OK);
    assert.match(r.stdout, /TODO\(project\) markers remaining: \d+ across \d+ files/);
    assert.match(r.stdout, /\.ai\/00-charter\.md/);
  });
});

describe("init-project — running twice", () => {
  test("a second run is refused and names the recovery command", () => {
    const root = freshKit();
    assert.equal(init(root, OK).status, 0);
    const second = init(root, ["--name", "Something Else", "--owner", "@other"]);
    assert.equal(second.status, 1);
    assert.match(second.stderr, /already been stamped/);
    assert.match(second.stderr, /git checkout -- CLAUDE\.md/);
    assert.match(read(root, "CLAUDE.md"), /^# Order Desk$/m);
  });

  // There is no --force, on purpose: the edits are anchored on placeholder strings that a first run
  // consumes, so the flag could not keep its promise. An unknown flag must be refused rather than
  // ignored — a silently-accepted --force would read as a re-stamp that did not happen.
  test("--force is not a flag", () => {
    const root = freshKit();
    assert.equal(init(root, OK).status, 0);
    const second = init(root, [...OK, "--force"]);
    assert.equal(second.status, 1);
  });
});

describe("init-project — the audit still passes afterwards", () => {
  // The point of the whole kit is that check-docs.mjs is the one thing nobody has to trust. A
  // bootstrap that leaves it red has broken the only signal a new project has.
  test("a stamped repository audits clean", () => {
    const root = freshKit();
    assert.equal(init(root, [...OK, "--prefixes", "ORD=Orders,PAY=Payments"]).status, 0);
    const a = audit(root);
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.match(a.stdout, /errors: 0/);
    // D1 is on now, so it must stop saying it is unconfigured.
    assert.doesNotMatch(a.stdout, /D1 checked nothing/);
  });

  test("an unstamped clone audits clean too", () => {
    const a = audit(freshKit());
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.match(a.stdout, /D1 checked nothing/);
  });
});
