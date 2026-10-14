---
ticket: CICD-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-14T04:06:44+00:00
inputs_read:
  - .ai/board/tickets/CICD-05/01-plan.md
  - .ai/board/tickets/CICD-05/03-impl-log.md
  - .ai/board/tickets/CICD-05/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/01-operating-model.md
  - .ai/standards/git-conventions.md
  - .ai/registry/rules.md
  - .ai/registry/invariants.md
  - "git diff origin/main...HEAD (origin/main 309091d, HEAD 6685204)"
  - "git status --porcelain (clean)"
consulted: []
chat_before_verdict: none
gate: FAIL
blocking_reason: "R1: src/components/TopBar.tsx is committed on feat/CICD-05 and is outside allowed_paths (node scripts/check-allowed-paths.mjs exits 1). It was written by three operator-requested chore commits (7e02a0e, 88a0b3b, 6685204), not by the CICD-05 Developer, and the Developer cannot remove it without itself editing outside allowed_paths (RULE-03). Routed to a human rather than charged to the Developer (RULE-08). Every other check passes; the five CICD-05 drafts match plan § 4 byte for byte."
next_state: ESCALATED
verdict: FAIL
failed_checks: [R1]
invariant_violation: false
route_to: human
increments_rework: false
---

# CICD-05 — Review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted carry | **FAIL** | `node scripts/check-allowed-paths.mjs` → exit 1: `allowed-paths: FAIL — files outside allowed_paths (RULE-03): - src/components/TopBar.tsx`. The out-of-scope lines are `src/components/TopBar.tsx:103`, `:237-245`, `:302`, from commits `7e02a0e`, `88a0b3b`, `6685204` (`chore(shell): …`, body: "Operator-requested on feat/CICD-05, outside CICD-05's scope"). Uncommitted half: `node scripts/check-carry.mjs CICD-05` → exit 0, `0 uncommitted path(s)`, `PASS — nothing stray`. |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint src/components/TopBar.tsx` → exit 0 (the only lintable file in the diff; the five drafts are YAML, CODEOWNERS and Markdown). Repo-wide `pnpm exec eslint .` → exit 0, nothing to route as a chore. |
| R4 | Nothing outside the seam reaches the datastore | PASS | No datastore reference in the diff. The drafts touch only Docker and git (`docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml:70-75`, `:88-92`); the out-of-scope TopBar change is a `<Link>` (`src/components/TopBar.tsx:242`). Plan § 5: no `src/` change intended. |
| R5 | Every § 4 contract item implemented | PASS | § 4.1–4.4 extracted from `01-plan.md` and `diff`ed against the four files: identical (`docs/ops/deployment-repo/apps/calechip/compose.yml:1-29`, `.github/workflows/deploy-calechip.yml:1-137`, `.github/workflows/pr-scope.yml:1-37`, `.github/CODEOWNERS:1-4`). README per AC-18..AC-20 — see R5 detail. |
| R6 | Permission gating matches plan § 3 | PASS | § 3: no product role changes. `deploy-calechip.yml:11-14` (push to `main` on `apps/calechip/**` only), `:16-18` (`contents: write`, `pull-requests: write`), `:30` (`[self-hosted, linux, home-wsl]`); `pr-scope.yml:7-9`, `:11-13` (read-only), `:17` (`ubuntu-latest`). No `secrets.` in either file. |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml`). See R7 detail. |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. `actions/checkout@v7` (`deploy-calechip.yml:32`) is an action in an inert draft under `docs/`, not a project dependency. |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `name: calechip`, one service `calechip` (AC-1) | `docs/ops/deployment-repo/apps/calechip/compose.yml:11-14` | yes |
| 4.1 `image: ${CALECHIP_IMAGE:?…}`, sole image reference (AC-1) | `compose.yml:15` | yes |
| 4.1 healthcheck + `restart: unless-stopped` (AC-3) | `compose.yml:16-22` | yes |
| 4.1 `networks: [tunnel]`, external, placeholder name (AC-2); no ports/env/secrets/volumes (AC-4) | `compose.yml:23-29` | yes |
| 4.2 `on:` (AC-5) | `.github/workflows/deploy-calechip.yml:11-14` | yes |
| 4.2 `permissions:` (AC-7) | `deploy-calechip.yml:16-18` | yes |
| 4.2 `concurrency:` (AC-6) | `deploy-calechip.yml:20-22` | yes |
| 4.2 `runs-on`, `timeout-minutes` (AC-7) | `deploy-calechip.yml:30-31` | yes |
| 4.2 step `release`, outputs `skip,image,previous` (AC-8..AC-10) | `deploy-calechip.yml:37-66` | yes |
| 4.2 step `deploy` (AC-11) | `deploy-calechip.yml:68-75` | yes |
| 4.2 step `rollback`, output `result` (AC-12, AC-13) | `deploy-calechip.yml:77-109` | yes |
| 4.2 step `notify` (AC-14) | `deploy-calechip.yml:111-137` | yes |
| 4.3 `pr-scope` workflow and job (AC-15, AC-16) | `.github/workflows/pr-scope.yml:1-37`; head ref via `env:` at `:23`, used at `:26` | yes |
| 4.4 CODEOWNERS (AC-17) | `.github/CODEOWNERS:1-4` | yes |
| AC-18 section order | `README.md:7,33,67,87,116,145,170` | yes |
| AC-18 checklist, item 1 = secrets; private, network, ingress, hand-run container, pull, `DEPLOY_REPO`, bot push | `README.md:37,40,42,45,47,49,51,53` | yes |
| AC-19 image and folder only, never the database; migrations compatible (RULE-09); restore is still red | `README.md:128-129`, `:137-140` | yes |
| AC-20 non-root, this repo only, `home-wsl`, outbound only; `docker` group = root; no `pull_request` on the self-hosted runner | `README.md:149-156`, `:161-168` | yes |
| 4.5 fixed names | as above; none added | yes |

AC-11's "the file contains no `migrate`" is read as being about commands: the only occurrence is the
header comment at `deploy-calechip.yml:8`, which § 4.2 specifies verbatim as part of a file given
"exactly". The literal reading would make § 4.2 contradict AC-11, and the exact contract is what was
implemented. No command in the file reaches a database.

## R7 detail

`invariants_touched` is empty, so there is no per-ID row owed. Reasoned anyway against INV-01..INV-07
(`.ai/registry/invariants.md` § Ledger), which constrain entries and the absence count:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01..INV-07 | Not reachable. The five drafts are inert files under `docs/ops/` that nothing in this repository executes; the out-of-scope TopBar change adds a navigation link and changes no entry, count or permission path | `deploy-calechip.yml:1-137`; `src/components/TopBar.tsx:103,241-245,302` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R1 | `src/components/TopBar.tsx` is in `git diff origin/main...HEAD` and not in `allowed_paths`. It entered through three `chore(shell)` commits made on `feat/CICD-05` at the operator's request (`7e02a0e`, `88a0b3b`, `6685204`), which `.ai/standards/git-conventions.md` § *The second exception* says belong on `ops/<slug>`, not on a ticket branch. CI's `check-allowed-paths.mjs` will fail the PR on the same file. | human | No |

**Why `human` and not the tabulated `developer` row.** The failure routing table sends R1 to the
Developer with an increment. Here the Developer did not write the file (`03-impl-log.md` lists only
the five drafts), and the Developer cannot fix it: reverting `TopBar.tsx` is itself an edit outside
`allowed_paths` (RULE-03), and moving commits between branches is outside its stage. Charging it
would burn rework budget for a defect it did not cause, which RULE-08 forbids, and REWORK would
deadlock exactly as an out-of-diff lint error does (ADR-041).

**What unblocks it — a human decision, one of:**

1. Move the three chore commits to `ops/<slug>` cut from `origin/main` and drop them from
   `feat/CICD-05` (rebase), then re-run `/review CICD-05` in a fresh session. The CICD-05 content
   itself needs no change.
2. Ship the TopBar change with CICD-05 by adding `src/components/TopBar.tsx` to `allowed_paths`
   through a plan amendment (`tech-lead-design`), then re-review.

## Verdict

`FAIL` on R1, routed to a human, `next_state: ESCALATED`, `rework_count` unchanged. R2–R8 pass and
the CICD-05 deliverable matches its contract exactly.
