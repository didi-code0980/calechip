// init-project.mjs — stamp the mechanical placeholders when a project is cloned from this kit.
//
// SETUP.md lists ten steps. Nine of them need a human to decide something; this script does the
// tenth kind of work — the substitutions where the answer is already known the moment the operator
// types the command, and typing them by hand into four files is how one of the four gets missed.
//
// What it deliberately does NOT do: write the charter, the invariants, the architecture, the role
// matrix or a single feature row. A template that pre-fills those ships a lie that every agent then
// reads as true, and no check in the audit can tell that a plausible invariant describes a different
// product. Everything this script cannot know stays a TODO(project): marker, and the script's last
// act is to print how many are left and where.
//
// Windows-native: no shebang, no shell. Invoked as: node scripts/init-project.mjs
//
// Usage:
//   node scripts/init-project.mjs --name "Order Desk" --owner @acme/platform
//   node scripts/init-project.mjs --name "Order Desk" --owner @jdoe --prefixes "ORD=Orders,PAY=Payments"
//   node scripts/init-project.mjs --name "Order Desk" --owner @jdoe --dry-run

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const USAGE = `
init-project — stamp the mechanical placeholders in a fresh clone of this kit.

  --name "<product name>"     required. Becomes the CLAUDE.md heading.
  --owner @handle|@org/team   required. Replaces @OWNER in .github/CODEOWNERS.
  --prefixes "ABC=Expansion"  optional, comma-separated. Turns check D1 on.
  --slug <package-name>       optional. Defaults to a slug of --name.
  --dry-run                   print the edits, write nothing.
  --help

After it runs: node scripts/check-docs.mjs
`.trim();

// --- arguments -------------------------------------------------------------------------------

function fail(msg) {
  process.stderr.write(`init-project: ${msg}\n\n${USAGE}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run" || a === "--help") {
      out.flags.add(a.slice(2));
    } else if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith("--")) fail(`--${key} needs a value`);
      out[key] = val;
      i++;
    } else {
      fail(`unexpected argument: ${a}`);
    }
  }
  return out;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Kept in step with the constant of the same name in scripts/check-docs.mjs. Every worked example
// in this kit cites EXA-01, and D1 exempts only .ai/templates/ and features.md — so a project that
// declared EXA as a real group would be policing the kit's own prose.
const RESERVED_EXAMPLE_PREFIX = "EXA";

// "ORD=Orders,PAY=Payments" -> [{prefix:"ORD", expansion:"Orders"}, ...]
//
// The expansion is mandatory rather than optional. A prefix with no words behind it is exactly the
// state the origin project got wrong twice: the audit polices the prefix, a human reads a bare
// three-letter code, and nobody can say what belongs in the group.
function parsePrefixes(raw) {
  if (!raw) return [];
  return raw.split(",").map((pair) => {
    const [prefix, ...rest] = pair.split("=");
    const p = (prefix ?? "").trim().toUpperCase();
    const expansion = rest.join("=").trim();
    if (!/^[A-Z]{3}$/.test(p)) fail(`prefix "${p}" is not three uppercase letters`);
    if (p === RESERVED_EXAMPLE_PREFIX) {
      fail(
        `prefix ${RESERVED_EXAMPLE_PREFIX} is reserved for the worked examples in this kit —`
        + ` check D1 drops it. Choose another three letters.`
      );
    }
    if (!expansion) fail(`prefix ${p} has no expansion — write it as ${p}=Something`);
    return { prefix: p, expansion };
  });
}

// --- edits -----------------------------------------------------------------------------------
//
// Every edit names the exact string it expects to find. A missing marker is an error and not a
// silent skip: it means the template drifted from this script, and stamping four of five files is
// worse than stamping none, because the repository then looks configured.

const CLAUDE_TITLE = "# TODO(project): the product name";

const CODEOWNERS_TODO = `# TODO(project): replace @OWNER with the GitHub handle or team that must review these paths, and turn
# on branch protection requiring CODEOWNERS review. Until both are done, RULE-01 has no mechanism at
# all and the enforcement map in .ai/registry/rules.md is claiming something untrue.`;

const CODEOWNERS_STAMPED = `# Owner stamped by scripts/init-project.mjs.
#
# TODO(project): branch protection requiring CODEOWNERS review is a GitHub repository setting and no
# script can turn it on. Until it is on, this file is documentation rather than a control, RULE-01
# has no mechanism, and the enforcement map in .ai/registry/rules.md is claiming something untrue.`;

function editClaudeMd(text, { name }) {
  if (!text.includes(CLAUDE_TITLE)) throw new Error(`CLAUDE.md: heading "${CLAUDE_TITLE}" not found`);
  return text.replace(CLAUDE_TITLE, `# ${name}`);
}

function editCodeowners(text, { owner }) {
  if (!text.includes("@OWNER")) throw new Error(".github/CODEOWNERS: @OWNER not found");
  if (!text.includes(CODEOWNERS_TODO)) throw new Error(".github/CODEOWNERS: the TODO block not found");
  return text.replace(CODEOWNERS_TODO, CODEOWNERS_STAMPED).replaceAll("@OWNER", owner);
}

function editPackageJson(text, { slug }) {
  const pkg = JSON.parse(text);
  pkg.name = slug;
  pkg.description =
    "Project repository stood up from aifw-template. Operating model in .ai/, agents and commands"
    + " in .claude/. See SETUP.md for what remains to be configured.";
  return JSON.stringify(pkg, null, 2) + "\n";
}

// The only registry file this script writes, and only when --prefixes is passed.
//
// RULE-01 makes .ai/registry/** human-only. Passing --prefixes on the command line IS the human
// decision — it is not the script choosing a set of groups — but the script says so out loud
// afterwards, because a registry file that changed without anybody noticing is the failure mode
// RULE-01 exists to prevent.
function editFeatures(text, { prefixes }) {
  if (prefixes.length === 0) return text;
  if (!text.includes("<!-- id-prefixes: -->")) {
    throw new Error(".ai/registry/features.md: the empty id-prefixes line not found");
  }
  const line = `<!-- id-prefixes: ${prefixes.map((p) => p.prefix).join(" ")} -->`;
  let out = text.replace("<!-- id-prefixes: -->", line);

  const rows = prefixes.map((p) => `| ${p.prefix} | ${p.expansion} |`).join("\n");
  const placeholderRow = /^\| TODO\(project\) \|.*\|$/m;
  if (!placeholderRow.test(out)) {
    throw new Error(".ai/registry/features.md: the placeholder prefix row not found");
  }
  out = out.replace(placeholderRow, rows);

  // One section per prefix, each with the column header and no rows. Rows arrive one at a time,
  // from a human, as ideas are promoted — never from here.
  const sections = prefixes
    .map(
      (p) =>
        `## ${p.prefix} — ${p.expansion}\n\n`
        + `| ID | Title | Group | Status | Invariants touched | Notes |\n`
        + `|----|-------|-------|--------|--------------------|-------|\n`
    )
    .join("\n");
  const groupHeading = "## TODO(project): group sections go here";
  const idx = out.indexOf(groupHeading);
  if (idx === -1) throw new Error(".ai/registry/features.md: the group-sections heading not found");
  return out.slice(0, idx) + sections;
}

// --- remaining markers -----------------------------------------------------------------------

const SETUP_ORDER = [
  ".ai/00-charter.md",
  ".ai/registry/glossary.md",
  ".ai/registry/invariants.md",
  ".ai/standards/architecture.md",
  ".ai/standards/data-model.md",
  ".ai/standards/rbac-and-security.md",
  ".ai/standards/coding-standards.md",
  ".ai/standards/testing-standards.md",
  ".ai/standards/ui-design-system.md",
  ".ai/standards/integrations.md",
  ".ai/standards/session-model.md",
  ".ai/01-operating-model.md",
  "CLAUDE.md",
  ".ai/registry/features.md",
  ".ai/registry/rules.md",
  ".ai/registry/tracker.yaml",
  ".github/CODEOWNERS",
  ".gitignore",
  ".ai/steward/context.md",
];

const SKIP_DIRS = new Set(["node_modules", ".git", "scripts"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (/\.(md|json|yaml|yml)$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function remainingMarkers(root) {
  const counts = new Map();
  for (const file of walk(root)) {
    const r = path.relative(root, file).split(path.sep).join("/");
    // SETUP.md and README.md describe the markers; they are not themselves places to fill in.
    if (r === "SETUP.md" || r === "README.md") continue;
    const n = (fs.readFileSync(file, "utf8").match(/TODO\(project\)/g) ?? []).length;
    if (n > 0) counts.set(r, n);
  }
  const ordered = [];
  for (const p of SETUP_ORDER) if (counts.has(p)) ordered.push([p, counts.get(p)]);
  const rest = [...counts.keys()].filter((p) => !SETUP_ORDER.includes(p)).sort();
  for (const p of rest) ordered.push([p, counts.get(p)]);
  return ordered;
}

// --- main ------------------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("help")) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (!args.name) fail("--name is required");
  if (!args.owner) fail("--owner is required");
  if (!args.owner.startsWith("@")) fail(`--owner must start with @ (got "${args.owner}")`);

  const name = args.name.trim();
  const owner = args.owner.trim();
  const slug = (args.slug ?? slugify(name)).trim();
  const prefixes = parsePrefixes(args.prefixes);
  const dryRun = args.flags.has("dry-run");

  // Stamping happens once per clone, and there is deliberately no --force.
  //
  // Every edit below is anchored on a placeholder string. Once those are gone, a second run has
  // nothing to match, so a --force flag would promise a re-stamp it could not perform — and the
  // alternative, matching whatever is there now, would silently rewrite a heading or an owner that
  // a human had edited on purpose. Getting the name wrong on a fresh clone costs one git command,
  // which the message below names.
  const claudeText = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
  if (!claudeText.includes(CLAUDE_TITLE)) {
    process.stderr.write(
      "init-project: this repository has already been stamped — CLAUDE.md no longer carries the\n"
      + "placeholder heading, so there is nothing left for this script to anchor on.\n\n"
      + "To stamp again, restore the four files first and re-run:\n\n"
      + "  git checkout -- CLAUDE.md .github/CODEOWNERS package.json .ai/registry/features.md\n\n"
      + "If any of them already carries work you want to keep, edit it by hand instead.\n"
    );
    return 1;
  }

  const plan = [
    { rel: "CLAUDE.md", fn: (t) => editClaudeMd(t, { name }), why: `heading -> "${name}"` },
    { rel: ".github/CODEOWNERS", fn: (t) => editCodeowners(t, { owner }), why: `@OWNER -> ${owner}` },
    { rel: "package.json", fn: (t) => editPackageJson(t, { slug }), why: `name -> "${slug}"` },
  ];
  if (prefixes.length > 0) {
    plan.push({
      rel: ".ai/registry/features.md",
      fn: (t) => editFeatures(t, { prefixes }),
      why: `id-prefixes -> ${prefixes.map((p) => p.prefix).join(" ")}, one empty section each`,
    });
  }

  const results = [];
  for (const step of plan) {
    const p = path.join(ROOT, step.rel);
    const before = fs.readFileSync(p, "utf8");
    const after = step.fn(before); // throws, naming the file, if a marker is missing
    if (after === before) throw new Error(`${step.rel}: nothing changed — the template has drifted`);
    results.push({ ...step, path: p, after });
  }

  if (!dryRun) for (const r of results) fs.writeFileSync(r.path, r.after);

  const head = dryRun ? "would write" : "wrote";
  process.stdout.write(`init-project — ${name}\n\n`);
  for (const r of results) process.stdout.write(`  ${head}  ${r.rel} — ${r.why}\n`);

  if (prefixes.length > 0) {
    process.stdout.write(
      `\nRULE-01 — .ai/registry/features.md is registry plane and was just written from the command\n`
      + `line. That is your decision rather than the script's, but it still needs the CODEOWNERS\n`
      + `review on the pull request that introduces it.\n`
    );
  }

  if (dryRun) {
    process.stdout.write(`\nDry run — nothing was written.\n`);
    return 0;
  }

  const left = remainingMarkers(ROOT);
  const total = left.reduce((n, [, c]) => n + c, 0);
  process.stdout.write(`\nTODO(project) markers remaining: ${total} across ${left.length} files\n`);
  process.stdout.write(`(SETUP.md order — the first ones gate the ones after them)\n\n`);
  for (const [file, n] of left) {
    process.stdout.write(`  ${String(n).padStart(3)}  ${file}\n`);
  }
  process.stdout.write(
    `\nNothing above is optional. Each marker is a place a template could not know the answer.\n`
    + `Next: node scripts/check-docs.mjs\n`
  );
  return 0;
}

try {
  process.exit(main());
} catch (e) {
  process.stderr.write(`init-project: ${e.message}\n`);
  process.exit(1);
}
