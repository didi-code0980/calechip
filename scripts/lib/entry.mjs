// Stage B of the unattended runner — how a run is entered, and what it reports afterwards.
// ADR-037. Split out of `run-loop.mjs` because entry resolution is the part with the most rules per
// line and the fewest side effects, and it is worth being able to test without a loop around it.
//
// Everything here is pure or takes its dependencies as arguments. Nothing in this file spawns a
// process; `run-loop.mjs` owns that.

import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const IDEAS_DIR = path.join(ROOT, ".ai", "board", "ideas");
export const TRACKER = path.join(ROOT, ".ai", "registry", "tracker.yaml");

export const MAX_INTAKE_QUESTIONS = 7;
export const AUTO_PROCEED_VERDICTS = ["PROMOTE"];      // REJECT and NEEDS-ADR always stop
export const ON_OPEN_QUESTIONS_AFTER_PLAN = "stop";    // layout-only entries never stop a run
export const ON_SPLIT = "stop";

// --- Tracker -------------------------------------------------------------------------------------

/** `tracker.yaml` nests two levels, so the ticket reader is not reused for it. */
export function parseTrackerYaml(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trimEnd();
    if (!line.trim() || /^\s/.test(line)) continue;
    const i = line.indexOf(":");
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (v === "") continue;
    out[k] = v.startsWith("[")
      ? v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean)
      : v.replace(/^["']|["']$/g, "");
  }
  return out;
}

/** "Is a tracker configured at all" — not "may this call go through", which is the hook's job. */
export function trackerConfigured(file = TRACKER) {
  if (!fs.existsSync(file)) return false;
  try {
    const y = parseTrackerYaml(fs.readFileSync(file, "utf8"));
    return Boolean(y.provider) && Array.isArray(y.allowed_list_ids) && y.allowed_list_ids.length > 0;
  } catch {
    return false;
  }
}

/**
 * Tracker entry is refused, and the refusal is a finding rather than a gap in the runner.
 *
 * Two independent blockers, both on disk. `.ai/registry/tracker.yaml` ships with
 * `allowed_list_ids: []`, and RULE-18 reads that as BLOCK EVERY CALL rather than as no restriction —
 * the file says so in its own header. And a pulled ticket has no path to `feature_ids`:
 * `/pull-tickets` writes only `tracker.raw_description`, RULE-17 makes that third-party data rather
 * than a specification, and ADR-007 issues IDs at TRIAGE. Without Definition of Ready item 1 the
 * ticket cannot reach READY, and issuing an ID here is the invention the charter forbids.
 */
export function trackerEntry(id, configured = trackerConfigured()) {
  const lines = [`tracker entry for \`${id}\` is not installed, for reasons that are on disk:`];
  if (!configured) {
    lines.push("  - .ai/registry/tracker.yaml has no provider and an empty allowed_list_ids, which");
    lines.push("    RULE-18 reads as BLOCK EVERY CALL rather than as no restriction.");
  }
  lines.push("  - a pulled ticket has no path to feature_ids: /pull-tickets writes only");
  lines.push("    tracker.raw_description, and ADR-007 issues IDs at TRIAGE, not at intake. Without");
  lines.push("    Definition of Ready item 1 the ticket cannot reach READY.");
  lines.push("");
  lines.push("Put the tracker description through triage as an idea instead:");
  lines.push('    node scripts/run-loop.mjs auto --idea "<the description>"');
  return { error: lines.join("\n") };
}

// --- Resolution ----------------------------------------------------------------------------------
//
// Deterministic, in a fixed order. The order matters more than any single rule in it: a string that
// looks like a ticket id but names no ticket is an ERROR, never a fall-through to "treat it as an
// idea". Falling through would turn one mistyped character into an idea file, a feature row and a
// ticket — three board and registry writes from a typo, discovered at the pull request.

const TRACKER_URL = /(?:^|\/)(?:t|task)\/([A-Za-z0-9_-]{6,})\/?$|^#([A-Za-z0-9]{6,})$/;
const TICKET_ID = /^[A-Z]{2,4}-\d{1,3}[a-z]?$/;

/**
 * @param {string|null} input   what the operator typed after `auto`
 * @param {object} opts         parsed CLI options; `opts.forced` is set by an explicit flag
 * @param {object} deps         { ticketFileExists, ideasDir?, trackerIsConfigured? }
 */
export function resolveInput(input, opts, deps) {
  const { ticketFileExists, ideasDir = IDEAS_DIR, trackerIsConfigured = trackerConfigured } = deps;

  // 1. An explicit flag wins and skips detection entirely.
  if (opts.forced) {
    const { kind, value } = opts.forced;
    if (kind === "ticket") {
      return ticketFileExists(value)
        ? { kind: "ticket", id: value, how: "--ticket" }
        : { error: `--ticket ${value}: no ticket.yaml on disk` };
    }
    if (kind === "idea-file") {
      return fs.existsSync(value)
        ? { kind: "idea", file: path.resolve(value), how: "--idea-file" }
        : { error: `--idea-file ${value}: not found` };
    }
    if (kind === "idea-text") return { kind: "intake", text: value, how: "--idea" };
    if (kind === "tracker") return trackerEntry(value, trackerIsConfigured());
  }

  // 2. Nothing at all: ask the orchestrator what is next.
  if (input === null || input === "") return { kind: "next", how: "no input" };

  // 3. A path that exists under .ai/board/ideas/.
  const asPath = path.resolve(ROOT, input);
  if (asPath.startsWith(ideasDir) && fs.existsSync(asPath)) {
    return { kind: "idea", file: asPath, how: "a path under .ai/board/ideas/" };
  }

  // 4 and 5. A ticket id resolves to its ticket, or it is an error. Never a fall-through.
  if (TICKET_ID.test(input)) {
    return ticketFileExists(input)
      ? { kind: "ticket", id: input, how: "a ticket id" }
      : { error: `${input} looks like a ticket id but has no ticket.yaml.\nIf you meant an idea, say so explicitly: --idea "${input}"` };
  }

  // 6. A tracker id or URL.
  const m = TRACKER_URL.exec(input.trim());
  if (m) return trackerEntry(m[1] ?? m[2], trackerIsConfigured());

  // 7. Anything else is a free-text idea.
  return { kind: "intake", text: input, how: "free text" };
}

// --- The verdict, read from disk -----------------------------------------------------------------

/**
 * Never parse the verdict out of reply text. Before ADR-037 there was nothing else to parse:
 * `gate:` is `PASS` on every idea file in `.ai/board/ideas/` including the one that was REJECTed,
 * `next_state` is `TRIAGE` on some promoted ideas and `BACKLOG` on others, and the verdict itself
 * lives in a free-form heading with at least eight shapes on disk. Two files carry two verdicts and
 * only one of them says which is live, in bold prose.
 */
export function readVerdict(file, readFrontMatter) {
  const fm = readFrontMatter(file);
  const rel = path.relative(ROOT, file);
  if (!fm) return { error: `${rel} has no front-matter` };
  if (!fm.verdict) {
    return {
      error: [
        `${rel} has no \`verdict\` in its front-matter.`,
        "TRIAGE ran but wrote the verdict only as a heading, which is the pre-ADR-037 shape and",
        "cannot be routed on — `gate:` is PASS on every idea file, including rejected ones.",
        "Read the file and decide by hand, or re-run /triage.",
      ].join("\n"),
    };
  }
  return {
    verdict: String(fm.verdict).toUpperCase(),
    reason: fm.verdict_reason ?? "",
    ticketId: fm.ticket_id || null,
  };
}

/** PROMOTE proceeds; REJECT and NEEDS-ADR always stop, with the reason TRIAGE gave. */
export function verdictStop(v) {
  if (AUTO_PROCEED_VERDICTS.includes(v.verdict)) return null;
  if (v.verdict === "REJECT") {
    return `TRIAGE returned REJECT: ${v.reason || "(no reason given, which is itself a gate failure)"}`;
  }
  if (v.verdict === "NEEDS-ADR") {
    return [
      `TRIAGE returned NEEDS-ADR: ${v.reason || "(no reason given)"}`,
      "",
      "The ADR should already be drafted — /triage writes it rather than handing you homework.",
      "Read it, accept or amend it, then run this idea file again.",
    ].join("\n");
  }
  return `TRIAGE returned an unrecognised verdict \`${v.verdict}\``;
}

// --- Checks after PLAN, before READY -------------------------------------------------------------

// The layout carve-out (CLAUDE.md, 2026-09-04) makes the visual arrangement of a screen
// `tech-lead-design`'s to originate, so a layout question blocks nobody. Everything else does.
// A tie goes to blocking: an entry this cannot classify is treated as needing a person.
const LAYOUT_ONLY = /\b(layout|arrangement|spacing|colou?r|placement|position|visual|density|icon|typography|label text)\b/i;
const BLOCKING_TOPIC = /\b(permission|role|admin|member|invariant|INV-\d+|behaviou?r|approve|reject|schema|RLS|policy|scope|quota|threshold)\b/i;

// Under the `m` flag `$` means end of LINE, so the section has to end at the next heading or at end
// of input written as a negative lookahead. Writing `|$` there matches immediately and yields an
// empty section, which reads as "no open questions" — a failure that passes.
const OPEN_QUESTIONS_SECTION = /^#{1,3}[ \t]*OPEN QUESTIONS[ \t]*$([\s\S]*?)(?=^#{1,3}[ \t]|(?![\s\S]))/mi;

/** Returns a stop reason, or null. `planText` is the content of `01-plan.md`. */
export function openQuestionsStop(planText) {
  if (!planText) return null;
  const m = OPEN_QUESTIONS_SECTION.exec(planText);
  if (!m) return null;

  const entries = m[1].split(/\n(?=[ \t]*(?:[-*]|\d+\.)[ \t])/).map((s) => s.trim()).filter(Boolean);
  const blocking = entries.filter((e) => BLOCKING_TOPIC.test(e) || !LAYOUT_ONLY.test(e));
  if (!blocking.length || ON_OPEN_QUESTIONS_AFTER_PLAN !== "stop") return null;

  const n = blocking.length;
  return [
    `01-plan.md carries ${n} OPEN QUESTIONS entr${n > 1 ? "ies" : "y"} touching behaviour, permissions or an invariant:`,
    "",
    ...blocking.map((e) => "  " + e.replace(/\s+/g, " ").slice(0, 300)),
    "",
    "A question here blocks; an assumption here ships (.ai/templates/plan.md).",
  ].join("\n");
}

/** `L` splits at PLAN and `XL` escalates — `.ai/01-operating-model.md` § Sizing. */
export function sizeStop(ticket) {
  const size = String(ticket.size ?? "").toUpperCase();
  if (size === "XL") {
    return "size is XL — the operating model escalates it rather than splitting it. A human decides.";
  }
  if (size === "L" && ON_SPLIT === "stop") {
    return [
      "size is L, which must split at PLAN.",
      "The children are the Tech Lead's to enumerate in 01-plan.md; the runner does not start them.",
      "MAX_TICKETS_PER_RUN is 1 and stays 1 until the stacking question in ADR-036 is decided.",
    ].join("\n");
  }
  return null;
}

// --- The run report ------------------------------------------------------------------------------

/**
 * `/triage` writes `.ai/board/ideas/**` and any ADR it drafts, and `/ship`'s ship set contains
 * neither — it is `allowed_paths` plus the ticket folder plus three named ship-owned paths
 * (ADR-023). Those files are therefore structurally orphaned: committed by nothing, landed by
 * nobody.
 *
 * Not hypothetical. MD-031 records UIE-08 shipping while citing an ADR and an idea file that exist
 * on no ref. The runner cannot fix it, because it never commits. It names them instead, every run.
 */
export function orphanPaths(dirtyPaths) {
  return dirtyPaths.filter(
    (p) => p.startsWith(".ai/board/ideas/") || p.startsWith(".ai/registry/decisions/")
  );
}

const bullets = (a) => (a && a.length ? a.map((x) => `- ${x}`).join("\n") : "_none_");

/** Written on every run, finished or stopped. */
export function renderReport(runId, r) {
  const qa = r.qa && r.qa.length
    ? r.qa.map((p) => `**Q.** ${p.question}\n\n**A.** ${p.answer || "_(not decided)_"}`).join("\n\n")
    : "_no intake questions were asked_";

  const fence = "```";
  const ending = r.stopped
    ? `## Stopped\n\n${r.stopped}\n\nTo resume:\n\n${fence}\n${r.resume ?? ""}\n${fence}`
    : "## Completed\n\nNothing is waiting on the runner.";

  const input = r.input === null || r.input === undefined
    ? "_(none — /next-ticket)_"
    : "`" + r.input + "`";

  return `# Run ${runId}

- **Finished:** ${r.finishedAt}
- **Input:** ${input}
- **Resolved as:** ${r.resolvedAs ?? "n/a"}
- **Ticket:** ${r.ticketId ?? "_none created_"}
- **Final state:** ${r.finalState ?? "n/a"}
- **Verdict:** ${r.verdict ?? "n/a"}${r.verdictReason ? " — " + r.verdictReason : ""}
- **Pull request:** ${r.prUrl ?? "_none opened_"}
- **Steps:** ${r.steps ?? 0} · **Rework cycles:** ${r.reworkCount ?? 0} · **Cost:** $${(r.cost ?? 0).toFixed(4)}

## Intake

${qa}

## Registry rows written in this run

These are in the working tree and **await your approval at the pull request** — RULE-01 puts
enforcement at CODEOWNERS review rather than at the write.

${bullets(r.registryWrites)}

## Layout originated under the carve-out

Visual arrangement \`tech-lead-design\` decided itself, with no image attached. Behaviour,
permissions and invariants are never covered by that carve-out.

${bullets(r.layoutDecisions)}

## Left dirty, and landed by nobody

\`/ship\` commits \`allowed_paths\`, the ticket folder and three named paths. Idea files and ADRs are
in none of those sets, so they stay in the working tree after the pull request is opened — see
MD-031, where a shipped ticket cited an ADR and an idea file that exist on no ref.

${bullets(r.orphanPaths)}

${ending}
`;
}
