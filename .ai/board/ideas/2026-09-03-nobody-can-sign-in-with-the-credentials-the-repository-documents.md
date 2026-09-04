---
stage: TRIAGE
agent: product
produced_at: 2026-09-03
inputs_read:
  - CLAUDE.md
  - .claude/commands/triage.md
  - .ai/templates/idea.md
  - .ai/steward/context.md
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/standards/tech-stack.md
  - .ai/standards/testing-standards.md
  - .ai/registry/decisions/ADR-021-the-qa-waiver-is-reverted.md
  - .ai/board/tickets/BUG-001/ticket.yaml
  - .ai/board/model-debt.md
  - supabase/seed.sql
  - src/lib/data/supabase.ts
  - src/routes/SignIn.tsx
  - tests/e2e/tea-05-sign-in.spec.ts
  - tests/e2e/cal-01-create-entry.spec.ts
  - tests/e2e/cal-02-edit-delete-entry.spec.ts
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - scripts/check-docs.mjs
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

## Problem

**A person cannot sign in to the running application with the credentials this repository tells them
to use.** They type `thanh@example.com` / `password123` — the address written in four end-to-end
specs and in `supabase/seed.sql` — and the sign-in form answers *"Email hoặc mật khẩu không đúng."*
The password is not wrong. The account does not exist in the database the application is pointed at.

The reason a person reaches that screen at all is the second half of the problem, and it is the part
that costs time rather than a retry: **the repository actively tells them those credentials work.**
The address is in the seed file, it is in the fixture module, it is named in a comment at the top of
four spec files, and the end-to-end suite that uses it is green. Every signal a reader can check says
the account is there. Only the running product disagrees, and it disagrees in the one vocabulary that
means "you made a typo".

Underneath: `supabase/seed.sql` has grown with almost every ticket since TEA-01, and the hosted
project the application actually runs against was seeded once and never again. The file and the
database are two different rosters, nobody declared them to be, and nothing in the repository
compares them.

## Who has it

**Whoever runs the application against the real datastore, on the first sign-in they attempt with a
seeded account that is not `quan@example.com`.** Today that is the operator; on this repository that
is also every future developer, because `.env` carrying `VITE_SUPABASE_URL` is what makes
`src/lib/data/index.ts` resolve to the Supabase seam at all, so anyone who can run the product
against real data is in exactly this position.

It is not once. It recurs per account and per ticket: the person hits it again the next time they
reach for an address a newer ticket introduced. `thanh` and `hoa` (TEA-05) and `linh` (CAL-02) are
each a separate encounter, and CAL-03 — in flight right now — documents `thanh@example.com` in its
own spec header at `tests/e2e/cal-03-admin-edit-entry.spec.ts:29`.

## Evidence

**Three measurements, taken by the dispatching session on 2026-09-03 against the project named in
`.env` (`VITE_SUPABASE_URL`).** They are recorded here verbatim rather than re-derived. This agent
holds no `Bash` tool and could not re-execute them; everything else in this file was verified by
reading the files named in `inputs_read`.

1. `POST /auth/v1/token?grant_type=password` with the anon key, body
   `{"email":"thanh@example.com","password":"password123"}` →
   **HTTP 400**, body `{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}`.
2. The identical call for `hoa@example.com` → **HTTP 400**, same body.
3. The identical call for `quan@example.com` / `password123` → **HTTP 200**, with an access token.

Measurement 3 is what makes this diagnosis rather than a guess: the project is reachable, the anon
key is correct, and the seed *was* applied — the first block of it. `quan` is the TEA-01 account.

**`git log -S<email> -- supabase/seed.sql` dates each seeded address to the ticket that added it**
(also taken by the dispatching session):

| Address | Added by | Commit |
|---|---|---|
| `quan`, `an`, `binh` | TEA-01 | `c9e5574` |
| `cu` | TEA-03 | `39344ad` |
| `dung` | TEA-04 | `1e350e3` |
| **`thanh`, `hoa`, `khanh`** | **TEA-05** | **`a8a4f9b`** |
| `linh` | CAL-02 | `3bb5474` |

The one account that signs in is the oldest one. The three that were measured failing, and the one
added most recently, are all after it.

**Verified by reading, in this run:**

- `supabase/seed.sql:341` inserts `thanh@example.com` with
  `extensions.crypt('password123', extensions.gen_salt('bf'))`. The file is not wrong; the file is
  simply not what the database contains.
- **There is no error-handling defect.** `src/lib/data/supabase.ts:207-208` maps `invalid_credentials`
  to a rendered message, and `src/routes/SignIn.tsx:95-97` renders it in `sign-in-error`. HTTP 400
  with `invalid_credentials` is how GoTrue reports bad credentials; the product handled it exactly as
  designed. What is wrong is upstream of every line of application code.
- **Four specs document the credentials that do not work:**
  `tests/e2e/tea-05-sign-in.spec.ts:10`, `tests/e2e/cal-01-create-entry.spec.ts:16`,
  `tests/e2e/cal-02-edit-delete-entry.spec.ts:22`, `tests/e2e/cal-03-admin-edit-entry.spec.ts:29`.
- **Nothing was ever going to notice.** BUG-001 pinned the end-to-end suite to the mock seam —
  `.ai/board/tickets/BUG-001/ticket.yaml` §5 records that a pinned build contains zero occurrences of
  `supabase.co` and is *structurally incapable* of reaching the live project. So the suite is green
  and says nothing whatever about the hosted database. The drift is invisible to every gate the
  project has and surfaces only when a human types credentials a test file told them to use.

## Impact if ignored

- **The gap widens by one ticket every ticket.** Each ticket that needs a fixture appends an account
  or a row to `supabase/seed.sql`, so the set of things written down but absent grows monotonically
  and never shrinks on its own.
- **It fails intermittently, and intermittently is worse than always.** Only the rows added after the
  last seeding are missing, so a person signs in as `quan` successfully, then as `thanh`
  unsuccessfully, in the same minute. That pattern reads as *"I mistyped the password"* or *"that
  account is broken"* — a per-account problem — rather than as *"the database is a version behind the
  repository"*. Every wrong first hypothesis is a session spent on the sign-in code, which is
  correct, and on the seed file, which is also correct.
- **It is not only accounts.** The unseeded portion of the file now includes `entry` rows: the
  approved entry `dd000000-…-0001` (CAL-02, `supabase/seed.sql:479`) and the other team's entry
  `dd000000-…-0002` (CAL-03, `:522`). CAL-02's own comments say the approved entry cannot be created
  through the product at all — no policy grants `status` — so against the live project the states
  those tickets exist to handle are unreachable by any means. Manual verification of shipped features
  silently checks a subset of what was built.
- **The drift runs in both directions.** ADR-021 and `.ai/board/tickets/BUG-001/ticket.yaml` record
  that unpinned acceptance runs created auth users in the live project, and BUG-001 §10 leaves
  *"inspecting what the acceptance runs already wrote to the live project"* explicitly out of scope
  and owed to a human. So the project may also hold rows that appear in no file. Left alone, neither
  side is a description of the other and there is no artifact that says so.
- **The confidence cost compounds.** The next person to hit this has to establish, from scratch, that
  the seed file, the fixture module, the error mapping and the sign-in form are all correct before
  they can conclude that the database is the thing that is behind. That work has now been done once;
  if it is not written down it will be done again.

## Constraints already known

Checked in this run, not assumed:

- **`.ai/registry/invariants.md` (doc_version 3) is not engaged.** All seven invariants range over
  `entry` and `member` rows and constrain the states data may be in. A database that is missing rows
  the seed file describes holds no wrong state — INV-01 to INV-07 each hold vacuously over the rows
  that are there. Stated as the mechanism rather than the conclusion, because that file warns at
  :62-66 that inferring "no invariant engaged" from safe behaviour is circular. **One adjacency
  worth naming for whoever plans this:** INV-04's denominator is the team's members with
  `removed_at is null`, so *adding* the missing `member` rows changes the absence count and the
  overload threshold for every date. That is a consequence of re-seeding, not of the drift.
- **ADR-005 — authorization lives in row-level security, and there is no server.** The browser holds
  the user's own token and talks to PostgREST directly. Two things follow. First, sign-in is
  GoTrue's, not this application's, so no code in `src/` can make a nonexistent account exist.
  Second, anything that reaches into the database to compare or repair rows is either a human running
  SQL with an elevated credential or a new mechanism that ADR-005 has not authorised — the solution
  space here is narrower than it looks.
- **BUG-001 and ADR-021 — the suite is pinned to the mock, and deliberately.** ADR-021 §"The six
  failures" traces why, and BUG-001 built it. **This is not a thing to undo.** The pin is what stops
  acceptance runs writing to the live project. Any answer here must leave the pin in place; a
  proposal that makes the suite touch the hosted database is proposing to revert BUG-001.
  `.ai/board/tickets/BUG-001/ticket.yaml` §10 already says a second suite against a real, dedicated
  test database is *"a separate decision"* with its own project, lifecycle and credentials.
- **`.ai/standards/tech-stack.md` § Datastore** — Supabase (PostgreSQL), migrations by Supabase CLI.
  Both rows still carry `TODO(project)`: the PostgreSQL major behind the hosted project is unrecorded
  and **the CLI is not installed**, and that file's *Still unverified* list names the CLI and its
  migration layout as things to read before writing an apply command. So "just run the seed" is not a
  command anybody in this repository has run and documented.
- **RULE-09 — schema changes and pull-request merges are permanently human**, and
  `supabase/seed.sql:1` opens *"Applied by a human (RULE-09), never by an agent."* Whatever is done
  here, the act of applying it is a person's.
- **`.ai/standards/testing-standards.md` § Fixtures** requires tests to share fixture data with the
  seed, *"a fixture that exists only in one test file drifts from the seed and produces failures that
  reproduce in CI and not locally."* The rule anticipated file-to-file drift. This is the same failure
  one layer down — file to **database** — and the standard has no rule for it.

**One thing a reader should not have to notice for themselves.** Every seeded account in
`supabase/seed.sql` uses the password `password123`, except `admin@calachip.com`, which uses `123456`
(`:121`). The project is a **real hosted Supabase instance**, not a local one, and its anon key is
public by design — `.ai/standards/rbac-and-security.md` already records that the endpoint is reachable
without this application. The seed file calls these *"development credentials"* that *"must not
survive contact with real data"* (`:103-104`), which is a stated intention and not a control.
**Whether that is acceptable for this project is the operator's judgement and is deliberately not
assumed here**, in either direction. It is surfaced because any answer to this idea involves deciding
what goes into that database, and that is the moment to decide it rather than after.

## Out of scope

- **Changing how the application handles a 400.** Stated plainly because it is the obvious framing
  and it is wrong: `src/lib/data/supabase.ts:207-208` and `src/routes/SignIn.tsx:95-97` are correct,
  the message is the right message, and a nonexistent account *should* be refused this way. A ticket
  that edits either file has misread this idea. In particular, making sign-in distinguish "no such
  account" from "wrong password" is a different question with a security argument attached, and it is
  not this one.
- **Reverting or weakening BUG-001's seam pin**, or pointing the end-to-end suite at the hosted
  project. See *Constraints*.
- **Standing up a second, dedicated test database.** Already named as its own decision in
  `.ai/board/tickets/BUG-001/ticket.yaml` §10 and in MD-021's fix shape. It may turn out to be the
  right answer to part of this, but it is not discharged here and must not be smuggled in.
- **Auditing or cleaning what past unpinned acceptance runs wrote into the live project.** Real,
  already owed to a human by BUG-001 §10, and a different piece of work.
- **Rotating or changing any credential**, including the two weak passwords named above. Surfacing
  them is not the same as deciding about them.
- **Changing the fixture module or the four spec headers.** They are accurate descriptions of
  `supabase/seed.sql`. The file they describe is not the thing that is wrong.

## Open questions

1. **Who owns applying the seed, and at what moment?** RULE-09 makes the act human. Nothing in the
   loop names *when* — no stage owns it, `/ship` does not, and no Definition of Done item mentions
   it. Until this is answered, a fix is a one-off repair rather than a mechanism, and the drift
   restarts with the next ticket.
2. **Is `supabase/seed.sql` meant to be re-runnable, and does the current file achieve it?** Every
   statement is `on conflict (id) do nothing` (`on conflict (email)` for `allowed_email`), so
   **re-running inserts what is missing and silently skips what is present** — which is exactly the
   repair this problem needs, and is safe against the existing rows. **But the same clause means it
   is not corrective:** a row already in the database keeps whatever values it has, so a changed
   password, `display_name`, `role` or `removed_at` in the file will never propagate. Is
   "converges on the missing rows, never on the changed ones" the intended contract, or is it an
   artefact of `do nothing` being the easy clause to write? An answer here decides whether re-seeding
   is a repair or a guarantee.
3. **What does re-seeding actually fire?** `admit_allow_listed_member` triggers on `auth.users`
   insert, and the seed's own comments (`:26-31`, `:170-175`, `:258-262`) reason carefully about it
   finding no allow-list entry and creating nothing. That reasoning was written for a fresh database.
   Has anyone confirmed it holds when the file is re-applied to a project that already contains
   `an@example.com`'s allow-list row, possibly consumed, and possibly auth users created by past
   unpinned runs?
4. **What is actually in the live project right now?** Nobody has listed it. The three measurements
   above establish that `quan` exists and `thanh` and `hoa` do not; the rest — `cu`, `dung`, `linh`,
   `khanh`, `chi`, `admin@calachip.com`, the second team, the two `entry` rows, the allow-list rows —
   is inferred from commit dates rather than observed. **A verdict does not strictly need this, but
   any fix does**, and it is cheap read-only work.
5. **Should the repository be able to detect this state at all?** Today the only detector is a human
   typing a password. Whether that is worth a mechanism — and, if so, whether the mechanism can exist
   at all without a credential that ADR-005 leaves nowhere to hold — is the question that decides
   whether this is one repair or a standing capability.
6. **Does anything else in the repository make the same class of claim?** The four spec headers and
   the fixture module describe the seed file, which was assumed to describe the database. If other
   documents assert facts about the live project's contents, they are wrong in the same way and by
   the same mechanism, and nobody has looked.
