---
doc_version: 1
last_updated: 2026-09-03
governed_by: [RULE-06, RULE-10]
---

# Backlog

**An ordered list, not a scored one.** A human reorders rows; the orchestrator takes the top of
READY. There is deliberately no priority algorithm, no score column, and no estimate-derived ranking.

**This is a view.** `ticket.yaml` is authoritative. On disagreement the orchestrator repairs this
file and does not touch `ticket.yaml` to make the view right.

**Do not run a generic prioritisation tool over this file.** It will produce a scored, reordered
list, which is exactly what the first sentence says it must never be.

## READY

Tickets that have been through PLAN and passed the full Definition of Ready. **READY means
planned, sized, and safe to build** — the next stage for a row here is IN_PROGRESS, not PLAN.

| # | Ticket | Title | Size | Depends on |
|---|--------|-------|------|------------|

## BACKLOG

Tickets awaiting PLAN. **Ordered.** A human reorders; the orchestrator takes the top.

Under the current gate placement a ticket sits here until it has been planned — DoR is evaluated
*after* PLAN. A row still at `BACKLOG` has not failed DoR; it has not reached it.

| # | Ticket | Title | State | Blocked on |
|---|--------|-------|-------|------------|

***THIS TABLE IS EMPTY AGAIN — THE SECOND TIME, AND THE FIRST TIME IT HAPPENED THE ROWS CAME BACK
WITHIN THE HOUR.*** `UIE-06` left it for `## ARCHIVE` on 2026-09-08. **All twenty-nine tickets on the board are
`DONE`** — counted, not recalled — and every `CAL`, `TEA`, `ADM`, `OPS`, `BUG` and `UIE` row with them.

**What reopens the loop is unchanged and is written where it was written the first time**, under the
`## BACKLOG` heading's original empty-table paragraph further down: nothing in the loop produces work
on its own, and `/triage` is the door. **What is different this time is that the queue behind that
door is no longer hypothetical — TWO ADRs are drafted, PROPOSED, and waiting on the operator, and
they are a matched pair pointing in opposite directions:**

- **[ADR-029](../registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md)** —
  the week view **gains** a per-day absence count.
- **[ADR-031](../registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md)** —
  the month cell **loses** its absence count.

**Both change an envelope rather than deciding inside one, so under ADR-008 no agent may accept
either.** And UIE-06's own plan — written after ADR-031 was drafted — records three reasons the month
count is load-bearing, without setting out to argue with it: it is what makes one-avatar-per-member
read correctly (INV-04), and it is the only surface on which a half day is expressible on that screen
at all (INV-06). That is evidence the operator has that the ADR's author did not.

**The other four owed items are unchanged** and are listed under the original empty-table paragraph:
the `BUG` row for the 2000-against-1000 truncation limits, the `§ Colour` / `§ Type` / breakpoint
stubs, the two product names, and the `PLAN -> READY` loop step no command runs — now thirteen
tickets old.

**One smaller item was added by this ship.** `src/components/Sidebar.tsx:63-64` carries a comment
whose three clauses are false, the same ones UIE-06 corrected in `src/index.css`. It was left in place
deliberately: correcting it would have put a shell file in `allowed_paths`, and RULE-03's guard cannot
tell a comment from a rewrite.

**Renumbered to 1 by `orchestrator` at /ship on 2026-09-08**, when UIE-05 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering — `UIE-06` was already `depends_on: []` and blocked on
nothing, so nothing was unblocked by this ship. One row left.

**THE THREE ROWS ABOVE MET AT A MERGE, AND THE NUMBERS MOVED — NOTHING ELSE DID.** `OPS-004` and the
two `UIE` rows were each written into an EMPTY table, on branches that did not see one another, so
both sides produced a row 1. `OPS-004` reached `main` first (PR #68) and keeps the number it landed
with; `UIE-05` and `UIE-06` were rows 1 and 2 on their branch and are now 2 and 3. **That is an
artefact of two branches, not a statement about priority** — the header says a human reorders, and
none of the three paragraphs below was rewritten to match its row's new number. Read each one
against the ticket it names rather than the digit it opens with.
**Row 1 was appended by `product` at /triage on 2026-09-07, and it is the row the paragraph
immediately below was waiting for.** That paragraph says this table is empty and is **left standing
rather than rewritten** — it was true when `UIE-04` shipped and it stopped being true when this row
landed, which is exactly the door it describes: `/triage` turned a request into an idea and the idea
produced a shell. `product` asserts nothing about position, on the same stance every paragraph in this
file takes; it is row 1 because it is the only row, not because anybody placed it. It is from
`.ai/board/ideas/2026-09-07-a-new-project-admits-nobody-and-has-no-way-in.md`, whose *Triage verdict*
and *Re-triage verdict* sections are the reasoning.

**Four facts a human needs, and the first is not a priority question.**

1. ***THE VERDICT WAS `NEEDS-ADR`, NOT `PROMOTE`, AND ONLY HALF OF IT IS ON THIS TABLE.*** The idea
   split into two decisions that were deliberately not bundled. **This row is the first**: the
   first-admin deadlock, answered by a password-free bootstrap SQL file, `ACCEPTED by
   tech-lead-design` under ADR-008 as
   [ADR-030](../registry/decisions/ADR-030-the-first-admin-arrives-by-a-password-free-bootstrap-file.md)
   because it supersedes nothing — it is ADR-009's own recorded exit, made runnable after ADR-024
   closed the file that used to carry it. **The second has no row and must not get one**: the attached
   image's `YÊU CẦU ĐĂNG KÝ MỚI` sign-up approval queue reverses ADR-009 decision points 1 and 3,
   which carry `ACCEPTED by the operator`, so it stopped and went back as one question that is
   **unanswered**. It is (a) the bootstrap file only, (b) the bootstrap now and the queue as its own
   later ADR, or (c) both together — reproduced in full in the idea's verdict section.
2. **This row does not wait for that answer, and that is the load-bearing part.** It is unblocked
   under **all three** of (a), (b) and (c), because somebody has to be the first admin in every one of
   them: a queue whose approve action inserts a `member` row still needs an admin to press it, and one
   that files allow-list rows still needs an admin whose id goes in `added_by`. Answering the question
   neither unblocks this row nor invalidates it.
3. **`depends_on` is `[]` and it was measured rather than inherited.** Every ticket on this board is
   `DONE` and this table was empty, so no live ticket claims a path. **Appendix A of
   `.ai/board/tickets/TEA-01/02-design.md:840` — the disposable-test-database chore — is NOT a
   prerequisite**, measured: while it is unlanded the Supabase SQL editor is the only surface
   available on a hosted project, and that is precisely the surface this file is applied through.
   Landing it would give this ticket somewhere to rehearse, which is a convenience. It also has no
   ticket and no ID, so it could not go in that field in any case. `ticket.yaml` §6.
4. **It is a chore, so no new feature row was written** — a deliberate departure from ADR-007's
   PROMOTE default, the same one BUG-001, OPS-001 and OPS-002 took, and **unlike `UIE-01`, whose
   version of this argument ADR-028 overruled by declaring a feature group**. There is no group for
   operational bootstrap procedures and declaring one is an ADR and the operator's. The provenance is
   one sentence appended to the `Notes` of `TEA-01` in `.ai/registry/features.md`, and nothing else.
   **That row's `TODO(project)` is deliberately NOT marked closed**: it closes when the file reaches
   `main`, not when a ticket points at it.

**Two things a human may want to settle before it is planned, and neither is its position.**

- **`.ai/standards/data-model.md` § *Seed data* will be one file out of date the moment this ships,
  and this ticket may not fix it.** That file is human plane under RULE-01, so the paragraph
  distinguishing the bootstrap file from the two things already described there belongs to `/thuki`
  on an `ops/<slug>` branch. **It is the third item now waiting on that session**, beside § *Colour* /
  § *Type* and the `PLAN -> READY` gap named below. `ticket.yaml` §8.
- **`supabase/db.sql` § 9.1 and § 9.2 are stale**, found during this triage and out of scope here:
  they say `public.team` has no select policy and no update policy, while
  `20260904100000_cal04_team_select.sql` and `20260905000000_adm01_team_threshold.sql` both shipped.
  Under ADR-026 that file is the target schema and is applied by hand to stand up a fresh project, so
  a reader following § 9 will believe two screens are broken that are not. **It has no row**, and it
  sits in the file whoever applies this ticket's bootstrap will be standing next to.
**Row 2 was appended by `product` at /triage on 2026-09-07, later the same day, and `product` asserts
nothing about its position.** Same stance as every paragraph in this file: the header says a human
reorders, so placing it above row 1 would have moved a row that was already here. Nothing was
renumbered and no row moved relative to another.

It is from
`.ai/board/ideas/2026-09-07-the-month-grid-is-the-only-calendar-surface-still-drawn-in-defaults.md`;
that file's *Triage verdict* section is the reasoning, and
`.ai/board/tickets/UIE-06/design/README.md` is the visual reference — **a hand transcription of the
operator's second image of the day, shown in conversation and never on disk, and a different image
again from UIE-05's and from the one UIE-02, UIE-03 and UIE-04 were built against.**

**Four facts a human needs, and none of them is a priority question.**

1. **`depends_on` is `[]` and Definition of Ready item 3 passes today.** UIE-01 through UIE-04 are
   DONE. **UIE-05 is deliberately not named**: it owns `src/routes/WeekView.tsx` and this row owns
   `src/routes/MonthView.tsx`, which are disjoint, and `allowed_paths` is `[]` on every ticket on the
   board so nothing claims a path. **The one file that could collide is `src/index.css`** if both
   tickets add a token, and both shells record that neither expects to. One working directory holds
   one branch (ADR-006), so only one is ever in flight regardless.
2. **This idea was cut in two at triage as well, and the other half is not a ticket.** The picture
   **deletes the per-cell absence count** — `month-cell-count` — and that is a domain amendment rather
   than a restyle: CAL-04 AC-3 states INV-04's formula in words, and `CAL-04/01-plan.md:192` grants the
   Tech Lead the count's *position* while saying nothing about its *presence*. It went to
   `.ai/board/ideas/2026-09-07-the-month-cell-number-is-what-stops-the-avatars-being-counted.md` on a
   **NEEDS-ADR** verdict, with
   [ADR-031](../registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md) drafted in full
   and **`PROPOSED` — awaiting the operator**. **This row does not wait on that decision** and ships a
   month grid matching the picture minus one small numeral per busy cell.
3. **Much of the picture is already on screen**, which is the finding most likely to move this
   ticket's size and is why no size is recorded here — the day numeral, the avatar chips and their two
   colours, the overloaded day's whole-cell pink, Monday-first whole weeks and greyed out-of-month
   days are all shipped. **What is genuinely missing is the full-pane width, the ruled single card,
   the cell height, the weekday strip's position, the out-of-month tint and the badge's slot.** The
   size will move on one thing that is not in that list: whether the plan also converts the grid onto
   UIE-01's and UIE-02's tokens, which it uses none of today.
4. **The load-bearing half of this ticket is what it does *not* do**, and `ticket.yaml` § 7 carries it
   as ten negative requirements. The four worth reading before planning: **no Vietnamese copy** —
   `CẦU` fails the build, not just review, because `eslint.config.js:84-92` lints JSX text for
   diacritics and `Ầ` is U+1EA6; **`month-cell-count` and `month-threshold` both stay**; **the bridge
   badge is not filled**, because pink is the overload colour and filling it paints a crowded-day
   signal onto a working day; and **no shell edit at all**.

**Two things a human may want to settle before it is planned, and neither is its position.**

- **ADR-029 and ADR-030 are now both on the desk, from two pictures by the same person on the same
  day, and neither is readable alone.** One adds a per-day absence count to the week view; the other
  removes it from the month view. **Neither violates INV-04** — the invariant governs the number's
  definition, not where it is rendered — but ADR-029 argues for itself by saying the week strip
  *"provably agrees with the month grid"*, and ADR-031 removes the surface that agreement was ever
  visible on. Both documents carry the interaction in a section of its own, so whichever is opened
  first says so. **They are two signatures, not one.**
- **`src/index.css:141-143` and `src/components/Sidebar.tsx:62-65` state something that is not true**
  — that no calendar view computes an overload state and that `seam.getTeam()` is not called by any of
  them. `MonthView.tsx:175` calls it and `:347` computes `isOverloaded`, and has since CAL-04 shipped
  the day before those comments were written; verified independently against source at this triage.
  **It is the recorded reason the sidebar has no overload legend row — the row both images draw.**
  Correcting the comments is two lines; building the row is a shell change nobody has scoped.

**Row 1 was appended by `product` at /triage on 2026-09-07, and `product` asserts nothing about its
position — it is row 1 because the table was empty, not because anyone placed it there.** The
paragraph immediately below said this table was empty and it was true for a few hours; it is left
standing rather than rewritten, on the same convention every corrected-in-place paragraph in this file
follows. **The door it names is the door that was used**: `/triage` turned a request into an idea and,
on a PROMOTE verdict, wrote the shell that became this row.

It is from
`.ai/board/ideas/2026-09-07-a-busy-week-does-not-fit-and-a-day-does-not-say-how-full-it-is.md`; that
file's *Triage verdict* section is the reasoning, and `.ai/board/tickets/UIE-05/design/README.md` is
the visual reference — **a hand transcription of an image shown in conversation and never on disk, and
a different image from the one UIE-02, UIE-03 and UIE-04 were built against.**

**Four facts a human needs, and none of them is a priority question.**

1. **`depends_on` is `[]` and Definition of Ready item 3 passes today — the first row in this group
   for which that is true.** UIE-01 through UIE-04 are all DONE, so the chain this screen sits on is
   complete. Nothing on the board claims a path, because nothing else is on the board.
2. **The idea it came from was cut in two at triage, and the other half is not a ticket.** The image's
   per-day footer count — `n/8 vắng` — went to
   `.ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md` on a **NEEDS-ADR** verdict, with
   [ADR-029](../registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md) drafted
   in full and **`PROPOSED` — awaiting the operator**. **This row does not wait on that decision**; it
   ships a screen matching the picture minus one strip along the bottom of each column. **The two were
   split rather than folded** because a count on this screen reverses CAL-05's registry row and
   UIE-04's shipped AC-13, and folding it into a restyle would have reversed three deliberate refusals
   somewhere nobody reviews them.
3. **Roughly half of what the image asks for is already on screen**, which is the finding most likely
   to change this ticket's size and is why no size is recorded here. The seven columns are already
   exactly equal in height; what is missing is that a column *fills* the viewport on a quiet week, and
   the answer is `min-height` rather than `height` — which is what lets UIE-04's AC-4 and AC-5 survive
   while its § 4.2 prose is reversed. `ticket.yaml` § 2 and § 3.1.
4. **The load-bearing half of this ticket is what it does *not* do**, and it is four negative
   requirements: no Vietnamese copy, no footer count, none of the chip's five facts deleted, and no
   shell edit. `ticket.yaml` § 7 carries them. **`week-day-empty` keeps its sentence** — its deletion
   is coupled to the footer count and is decided with it or not at all.

**One thing a human may want to settle before it is planned, and it is not its position.** ADR-029 is
the only ADR in this repository that an agent has drafted and refused to accept. It reverses a refusal
that CAL-05's row, CAL-05's plan and UIE-04's AC-13 each took deliberately, which is changing the
envelope rather than deciding inside it (ADR-008) — so the status may only ever read
`ACCEPTED by the operator` or `REJECTED`. **Two of the three reasons behind the standing refusal do
not survive being checked**, and that is true whichever way the operator decides: `absenceCountsFor`
is the one definition and needs no team read, so `src/routes/WeekView.tsx:11-17` owes a correction
even under a `REJECTED`.

***THIS TABLE IS EMPTY, AND IT IS THE FIRST TIME.*** `UIE-04` left it for `## ARCHIVE` on
2026-09-07, and with it the last of the twenty-six rows this board has carried. Every `CAL`, `TEA`,
`ADM`, `OPS`, `BUG` and `UIE` ticket is DONE.

**Nothing in this file describes this state, and nothing in the loop produces work on its own.**
`/next-ticket` reads an empty table and has nothing to report; `/plan` has no ID to take. **The loop
does not restart until a human puts a row here**, and the door back in is `/triage` — which turns a
request into an idea under `.ai/board/ideas/` and, on a PROMOTE verdict, writes the shell that
becomes row 1.

**Three things are already written down and waiting for that door, none of them invented here.**
Each is recorded in the file that found it, and each is the operator's to promote or to decline:

1. **A `BUG` row is owed and nothing issues it automatically** — the paragraph below, from ADM-04's
   ship, is unchanged and unactioned. `TEAM_ENTRY_LIMIT` and `MONTH_ENTRY_LIMIT` are 2000 in
   `src/lib/domain/types.ts` while the datastore caps at 1000, so their truncation assertions can
   never fire and **CAL-04 AC-11 is not held**: the month grid sums what it was given and shows a
   wrong count with no error anywhere.
2. **`§ Colour`, `§ Type` and a breakpoint have no standard behind them.** `.ai/standards/ui-design-system.md`
   § *Colour* and § *Type* are still bare `TODO(project)` stubs while `src/index.css` carries the
   real palette and type scale (UIE-01), and `1280px` was originated at UIE-04 as the product's
   first breakpoint. Writing those sections **from what shipped** is `/thuki`'s on an `ops/<slug>`
   branch — transcription, not authorship — and it is human plane under RULE-01 either way.
3. **The product shows two names.** `index.html:6` and `CLAUDE.md` say *CaleChip*; UIE-01 built the
   auth card as *Ai Nghỉ?* and UIE-02 put that string on every screen. It is one string in one file
   whichever way it goes, and it is unresolved.

**One model defect is also owed a row and has never had one.** Ten consecutive tickets recorded that
`PLAN -> READY` is a loop step (`.ai/01-operating-model.md:285`) that **no command runs** —
`/next-ticket` grades the Definition of Ready and writes no file by design, `/ship` transcribes both
gates at the end, and in between `state` and `gates.plan` sit stale on every ticket. Six shells blamed
a different owner for it, which is a good reason it was never fixed. That is `/thuki`'s.

**Renumbered to 1 by `orchestrator` at /ship on 2026-09-07**, when UIE-03 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **`UIE-04`'s `Blocked on` is cleared in the same write**,
because it named `UIE-03` and `UIE-03` is now DONE.

***ONE ROW LEFT ON THE WHOLE BOARD.*** Every `CAL`, `TEA`, `ADM` and `OPS` row has shipped and three
of the four `UIE` rows with them. `UIE-04` is the last link of the chain triage cut on 2026-09-05,
and after it this table is empty — **which is a state nothing in this file describes, and it is worth
a human deciding what happens then rather than discovering it at a `/next-ticket` that has nothing to
report.**

**Renumbered to 1–2 by `orchestrator` at /ship on 2026-09-07**, when UIE-02 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **`UIE-03`'s `Blocked on` is cleared in the same write**,
because it named `UIE-02` and `UIE-02` is now DONE. Two rows left on the whole board, and they are the
last two links of one chain: `UIE-03` is row 1 and blocked on nothing, `UIE-04` waits on it.

**Renumbered to 1–3 by `orchestrator` at /ship on 2026-09-07**, when UIE-01 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering — no row moved relative to another. **`UIE-02`'s
`Blocked on` is cleared in the same write**, because it named `UIE-01` and `UIE-01` is now DONE. It
is row 1 and blocked on nothing; rows 2 and 3 are the rest of the chain, each waiting on the one
above it.

**Three rows are all that is left on this board.** Every `CAL`, `TEA`, `ADM` and `OPS` row has
shipped, and what remains is one idea cut into four at triage, of which the first is now built.

**Renumbered to 1–4 by `orchestrator` at /ship on 2026-09-07**, when OPS-002 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering — no row moved relative to another. **The board is now
the UIE chain and nothing else.** Every `CAL`, `TEA`, `ADM` and `OPS` row has shipped, `UIE-01` at
row 1 is blocked on nothing, and rows 2, 3 and 4 are the rest of that chain, each waiting on the one
above it. One working directory holds one branch (ADR-006), so exactly one of the four is ever in
flight and the order is enforced by git rather than by policy.

**OPS-002 spent its whole life reading `BACKLOG` in this table**, exactly as the paragraph below
predicted when ADM-06 shipped: this column is written by `/ship` and by nothing else, so a ticket
planned, built and reviewed between two ships is stale here for that entire span. `/next-ticket` read
`ticket.yaml` over the view on both of its runs, which is what the header requires of it.

**Renumbered to 1–5 by `orchestrator` at /ship on 2026-09-06**, when ADM-06 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **The ADM group is empty and the board is now one
translation row and the four-row UIE chain** — six admin rows shipped, and `OPS-002` at row 1 is
blocked on nothing and has been since 2026-09-03. `UIE-01` at row 2 is also unblocked; rows 3, 4 and
5 are the rest of that chain and each waits on the one above it.

**This row spent its whole life at `BACKLOG` in this table while `ticket.yaml` moved it to `REVIEW`,
and `/next-ticket` on 2026-09-06 read the disagreement rather than the view.** The `State` column
here is written by `/ship` and by nothing else, so a ticket that is planned, built and reviewed
between two ships is stale in this file for that entire span. It is not a defect in this row; it is
what a view that has one writer at the end of the loop necessarily looks like from the middle of it.

**Renumbered to 1–7 by `orchestrator` at /ship on 2026-09-05**, when ADM-04 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **ADM-05 is now row 1 and is unblocked** — its
`Blocked on` names ADM-04, which just shipped, and CAL-02, DONE since 2026-09-03. The ADM chain is
down to its last two links, and ADM-05 is where the decision itself arrives: ADM-04 shipped the
worklist with **no approve control and no reject control**, which its registry row required.

**A `BUG` row is owed and nothing on this board issues one automatically.** ADM-04's PLAN answered
the `TODO(verify):` four tickets had been carrying — the datastore's default cap is **1000 rows**,
read off the installed client's own d.ts rather than recalled — and two shipped constants sit above
it. `TEAM_ENTRY_LIMIT` and `MONTH_ENTRY_LIMIT` are both 2000 in `src/lib/domain/types.ts`, so their
`rows.length >= 2000` truncation assertions can never fire: the server caps at 1000 and returns a
believable short list. **CAL-04 AC-11 is the acceptance criterion that is not held** — the month
grid sums what it was given and shows a wrong count with no error anywhere. `HOLIDAY_LIMIT` is 1000,
exactly equal, and survives only because the comparison is `>=`. PLAN recorded it rather than fixing
it, correctly: changing two numbers inside a ticket whose `invariants_touched` is `[]` would
silently alter two other tickets' criteria. `/triage` issues the row, and the cap is per-project
configurable, so the fix is a decision about which number moves.

**Renumbered to 1–4 by `orchestrator` at /ship on 2026-09-05**, when CAL-08 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **The CAL group is empty and every remaining row is
ADM or OPS** — eight calendar rows shipped, and ADM-04 at row 1 is unblocked: its `Blocked on`
names CAL-01, TEA-03 and ADM-01, all DONE. Rows 1, 2 and 3 are a chain (ADM-04 → ADM-05 → ADM-06)
whose head is free, and OPS-002 at row 4 is blocked on nothing and has been since 2026-09-03.

**ADM-04's registry row carries two `TODO(project):` markers that decide what its list contains**,
and they are the operator's in the same way CAL-08's bridge-day definition was — whether a WFH entry
goes through approval at all, and what happens to a pending entry whose date has passed
(`features.md:106`). Unlike CAL-08's, no ADR says these must not become a blocked gate. Recorded
here rather than left for PLAN to rediscover.

**Rows 5 to 8 were appended after that renumbering**, by `product` at /triage on 2026-09-05 and on the rebase onto CAL-08's merge. The paragraph above describes the table as it stood at that ship, so its *every remaining row is ADM or OPS* is true of rows 1 to 4 and was not made false retroactively.

**Rows 6, 7 and 8 were appended by `product` at /triage on 2026-09-05, and `product` asserts nothing
about their position.** Same stance as every paragraph in this file: the header says a human
reorders, so placing any of them higher would have moved rows a human placed. Nothing was renumbered
and no row moved relative to another. They are from
`.ai/board/ideas/2026-09-05-the-product-has-no-shell-and-every-screen-starts-over.md`; the *Triage
verdict* section of that file is the reasoning, and
`.ai/board/tickets/UIE-02/design/README.md` is the visual reference for all three — one transcription,
cited by the other two, because no image was ever on disk.

**Three facts a human needs in order to place them, and the first is not a priority question.**

1. **They are one idea cut into three, and the order is fixed rather than preferred:**
   `UIE-01` → `UIE-02` → `UIE-03` → `UIE-04`. `depends_on` names only the immediate link in each
   shell. **All three fail Definition of Ready item 3 today, on purpose** — item 3 requires every
   named ticket to be DONE and none of them is, `UIE-01` included. One working directory holds one
   branch (ADR-006), so exactly one of the four is ever in flight and the chain is enforced by git
   rather than by policy. Placing `UIE-04` above `UIE-02` would not make it buildable.
2. **The cut was made at triage so that PLAN never has to make it.** The whole mockup is nineteen
   files, which `.ai/01-operating-model.md:374` sizes as L, and L must split at PLAN. The cut is by
   surface, and each of the three leaves an application that renders and can be exercised end to
   end. **`UIE-02` deliberately ends with the application looking doubled** — a shell top bar above
   each screen's own header — because that is what buys it zero spec files; `UIE-03` is where the
   doubling ends and is the only one of the three that touches a test file.
3. **`UIE-04` carries a decision nobody has taken, and it is not a layout one.** The mockup's
   per-column footer reads `0/8 vắng`, and `src/routes/WeekView.tsx:11-17` records that this screen
   counts nothing — deliberately, because CAL-05's registry row says so and a second count is the
   second definition INV-04 exists to forbid. Reproducing that footer, or the overload row in the
   sidebar legend, needs an amendment to a feature row rather than an acceptance criterion.
   **If PLAN concludes it needs one, it stops and asks.** `ticket.yaml` § 4 carries it.
   **Re-read in the rebased file on 2026-09-05 rather than assumed** — the citation read `:11-16`
   before CAL-08 rewrote that file, and the paragraph survives it: `:11` still opens *"IT COUNTS
   NOTHING"* and `seam.getTeam()` is still deliberately not called.

**A fourth piece of the mockup was deliberately not promoted and has no row anywhere:** `Duyệt phép`,
~~the `Ngày lễ` legend row,~~ the palette icon and the `?` button. Each points at something that does
not exist — ADM-04, ADM-05 and ADM-06 for the first, and a question nobody has answered in either
direction for the other two. A row will be written when there is something for it to point at; a
promoted feature with nothing to build is worse than no row. The idea file's *Triage verdict* section
is the record of the deferral.

**The `Ngày lễ` legend row left that piece on 2026-09-05, later the same day, and is struck above
rather than deleted.** `CAL-08` merged in PR #56 and is `DONE`, so holidays are now drawn in all three
calendar views. The deferral's argument was *a legend row for a colour that never appears beside it is
a legend that lies*; **the colour now appears**, and the file the deferral cited says the reverse of
what was quoted from it (`src/routes/WeekView.tsx:28`). The row moved into `UIE-02`'s scope — that
ticket builds the sidebar — and **no new row was created anywhere**, because the ticket that brings
the control already existed. `.ai/board/tickets/UIE-02/ticket.yaml` § 9.3 carries the withdrawal.
**Nothing else moved with it:** the overload row was never part of this piece and is untouched, since
`CAL-08` brought a colour for holidays and no threshold, no team read and no overload state.

**Two other things the rebase changed, both worth a human's attention before any of the three is
planned.** **`UIE-03` grew:** it now edits **six** spec files, not five — `CAL-08` shipped
`tests/e2e/cal-08-holiday-shading.spec.ts`, which addresses two of the four `data-testid` names that
ticket deletes. **And every line citation into `WeekView.tsx`, `MonthView.tsx` and `YearView.tsx` in
all four `UIE` shells was stale by 28–35 lines and has been re-measured**; they did not move by a
uniform offset. `Holidays.tsx` and `App.tsx` were untouched by `CAL-08` and their citations stand.

**One thing a human may want to settle before any of the three is planned, and it is not their
position.** `UIE-04` § 3 finds that the mockup's seven fill-the-viewport columns **overflow by sixty
per cent** in the worst realistic week — ~168px per column, 90–110px per entry chip, and up to
sixteen chips on one day because a member may hold a morning and an afternoon entry on the same date.
The image shows an empty week, which is the one case that proves nothing. Three answers are
enumerated in that shell with a recommendation; PLAN chooses one and writes an acceptance criterion
against it, and *"looks like the screenshot"* is not available to it.

**Row 5 was appended by `product` at /triage on 2026-09-05, and `product` asserts nothing about its
position.** Same stance as every paragraph below: this file's header says a human reorders, so placing
the row higher would have moved five rows a human placed. Nothing was renumbered and no row moved
relative to another. It is from
`.ai/board/ideas/2026-09-05-the-first-screen-does-not-look-like-the-product.md`; the *Triage verdict*
section of that file is the reasoning, and `.ai/board/tickets/UIE-01/design/README.md` is its visual
reference.

**It was appended as `OPS-003` and is now `UIE-01`, changed by `product` on 2026-09-05 in the same
day.** Not a reordering and not a second ticket: the operator instructed that UI-enhancement work get
a feature group of its own, [ADR-028](../registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md)
declared `UIE` and recorded the instruction verbatim, and the ticket was renumbered into it with a
row of its own in `.ai/registry/features.md`. Its position, its title, its `depends_on` and its scope
are untouched.

**Three facts a human needs in order to place it.**

1. **`depends_on` is `[]`, and it was measured rather than inherited.** OPS-001 is `DONE` so its claim
   on `src/App.tsx`, `src/routes/SignIn.tsx` and `src/routes/SignUp.tsx` is released; OPS-002's five
   scope files are the entry screens and the two seam implementations, which are disjoint; and all
   ~~five~~ `BACKLOG` shells — ~~CAL-08,~~ ADM-04, ADM-05, ADM-06 and OPS-002 — carry
   `allowed_paths: []`, so **no live ticket claims a path at all**. That is a measurement taken on
   2026-09-05, not a standing guarantee: `src/App.tsx` has appeared in the `allowed_paths` of nine
   shipped tickets, and whichever row is planned next will fill its own. `ticket.yaml` §6 says to
   re-check at PLAN. **`CAL-08` struck from that list later the same day**, when it merged in PR #56
   and became `DONE`. **That is the thing this paragraph warned about actually happening, and it
   landed on the side that costs `UIE-01` nothing:** the paths it claimed were the three calendar
   views and `src/lib/data/`, none of which is in `UIE-01`'s scope. `depends_on: []` still holds,
   measured again rather than assumed.
2. ~~**It is a chore, so no new feature row was written** — a deliberate departure from ADR-007's
   PROMOTE default, the same one BUG-001 and OPS-002 took. The provenance is one sentence appended to
   the `Notes` of `TEA-01` and `TEA-05` in `.ai/registry/features.md`, and nothing else.~~
   **Overruled on 2026-09-05 and struck rather than deleted.** The BUG-001 and OPS-002 precedent does
   not carry here: ADR-028 gives visual work its own feature group, so **there is a row** — `UIE-01`
   in `.ai/registry/features.md`, `Status: PLANNED`, citing the idea file, which is the provenance
   ADR-007 asks of every promoted row. The two sentences on `TEA-01` and `TEA-05` are kept, marked as
   overruled, and now point at that row. Nothing about the work changed.
3. **What it does *not* do is the load-bearing half.** Vietnamese copy, username identity and the
   printed credential footer are all in the reference and all **out of scope**, each because it
   reverses a decision already taken — § *Language*, ADR-009/ADR-005, and TEA-05 AC-2 respectively.
   The avatar picker stays. `ticket.yaml` §4 carries them as negative requirements.

**One thing a human may want to settle before it is planned, and it is not its position.**
`.ai/standards/ui-design-system.md:17-24` — § *Colour* and § *Type* — are both bare `TODO(project)`
stubs, and that file is human plane under RULE-01. This ticket writes the first palette and the first
type scale the real application has had, into `src/index.css`. **If nobody fills § Colour, it becomes
the de-facto design system with no document behind it.** It is buildable either way; the cost is that
the next screen has nothing to conform to.

**Its branch is `feat/UIE-01`, and it costs nothing to argue for.** `.ai/standards/git-conventions.md:36`
asks for `feat/<FEATURE-ID>`, and `UIE-01` **is** a row in `.ai/registry/features.md` as of
2026-09-05 — so this is simply the convention followed, and the guard runs as a consequence rather
than as the reason. **The debt recorded for OPS-001 and OPS-002 four paragraphs below is discharged
for this ticket and for no other**: those two, and `feat/BUG-001`, take a `feat/` name for an ID that
has no feature row, because `scripts/check-allowed-paths.mjs:96` exits 0 with *"nothing to check"* on
any branch not beginning `feat/` and the alternative was RULE-03 unenforced across shipped
application files. That trade-off was settled by the operator on 2026-09-03; it is not reopened, and
it no longer applies here.

**Renumbered to 1–5 by `orchestrator` at /ship on 2026-09-05**, when ADM-03 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **CAL-08 is now row 1 and every one of its four names is
DONE** — ADM-02, CAL-04, CAL-05 and CAL-06. It is the row the holiday work was built for: ADM-02 made
the calendar exist, ADM-03 made it editable, and CAL-08 is where it finally appears in the three
views a person actually looks at.

**Renumbered to 1–6 by `orchestrator` at /ship on 2026-09-05**, when ADM-02 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **ADM-02 unblocked two rows at once by shipping** —
ADM-03 at row 1 and CAL-08 at row 2 both named it, and CAL-08's other three names (CAL-04, CAL-05,
CAL-06) are all DONE. So rows 1 and 2 are both free, and a human choosing between them is choosing
between the write path on the calendar and the calendar appearing in the three views.

**Renumbered to 1–7 by `orchestrator` at /ship on 2026-09-05**, when CAL-07 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **ADM-02 is now row 1 and is blocked on nothing** — its
`Blocked on` names TEA-01 and ADM-01, both DONE.

**Read `.ai/standards/data-model.md` OPEN QUESTIONS item 1 before planning ADM-02.** CAL-04's
registry row kept holiday shading deliberately out of scope because that open question *"blocks the
first story touching `holiday`"*, and ADM-02 is that story. It is the first row in months to reach
position 1 carrying a known, named precondition that is not a ticket dependency — so `depends_on`
will not surface it and DoR will not grade it, exactly like the pull-request precondition OPS-001 and
OPS-002 carried.

**Renumbered to 1–8 by `orchestrator` at /ship on 2026-09-05**, when ADM-01 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **CAL-07 is now row 1 and is blocked on nothing** — its
`Blocked on` names CAL-01 and CAL-04, both DONE. **ADM-02 at row 2 is also unblocked for the first
time**: its `Blocked on` names ADM-01, which is what just shipped, so the holiday calendar is
reachable — and rows 2, 3 and 4 are a chain that now has its head free.

**OPS-001 shipped from row 12 while CAL-04 sat at row 1, and the rows above it did not move.**
Recorded because this file's header reserves reordering to a human and says the orchestrator takes
the top — so this ship did not follow the order, and nothing in the table shows it. Only OPS-002
renumbered, 13 to 12, which is the ordinary bookkeeping when a row leaves. **CAL-04 is still row 1
and is still the top of this list.** If OPS-001 was meant to come first, the row a human moves is
the one that records it; if it was not, the order is intact and this paragraph is the only trace.

**Renumbered again to 1–11 by `orchestrator` at /ship on 2026-09-03**, when CAL-03 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-04 is now row 1**, and it is the first row in
months whose `Blocked on` was never CAL-01 alone — it names TEA-03 too, and both are DONE.

**BOTH PRECONDITIONS BELOW ARE NOW DISCHARGED — `Blocked on` repaired to `—` by `orchestrator` on
2026-09-03.** PR #37 merged as `3424f89`, so `§ Language` is on `main` and both tickets are valid
rather than hypothetical; CAL-03 shipped as PR #38 and its row is in `## ARCHIVE`, so the file
collision that produced `depends_on: [CAL-03]` is gone. **Neither ticket is blocked on anything.**
The three paragraphs below are left exactly as `product` wrote them, because they are the record of
what the dependency was and why — and the first of them is the only place the pull-request
precondition is written down at all.

**OPS-001 and OPS-002 were appended at rows 12 and 13 by `product` at /triage on 2026-09-03, and
`product` asserts nothing about their position.** Same stance as the TEA-05 and BUG-001 paragraphs
below: this file's header says a human reorders, so placing either row higher would have moved eleven
rows a human placed. Nothing was renumbered and no row moved relative to another. They are from
`.ai/board/ideas/2026-09-03-the-interface-and-its-standard-speak-different-languages.md`; the verdict
section of that file is the reasoning.

**Three facts a human needs in order to place them, and the first one is not a priority question.**

1. **`Blocked on` names a pull request, and no ticket field can carry that.** Both tickets exist to
   satisfy `§ Language` in `.ai/standards/ui-design-system.md`, which lives in exactly one commit —
   `3ccbd37`, the sole commit of `ops/ui-language-english`, **open as PR #37 and unmerged**. It is not
   on `main`. **If PR #37 does not merge, both tickets are invalid rather than blocked** and should be
   closed. `depends_on` names tickets and is graded against ticket state, so this precondition is in
   prose here and in §0 of each `ticket.yaml`, because there is no field for it and nothing in the
   loop will ask.
2. **Both are `depends_on: [CAL-03]`, which is row 1 and not yet DONE — so both fail Definition of
   Ready item 3 today, deliberately.** The dependency is a file collision rather than a behavioural
   one: CAL-03's `allowed_paths` claim five of the thirteen files in scope — `src/App.tsx` and
   `src/routes/Home.tsx` for OPS-001, and `src/routes/EditEntry.tsx`, `src/lib/data/mock.ts` and
   `src/lib/data/supabase.ts` for OPS-002. One working directory, one branch (ADR-006).
3. **Waiting costs something measurable, which is the argument for placing them early once CAL-03
   ships.** Twelve `PLANNED` rows above will each be built in English by the standard alone, at no
   cost, while the seven shipped features stay Vietnamese — so every row that ships before these two
   adds another screen where the two languages meet. CAL-03 is already the first: its new
   `src/routes/TeamEntries.tsx:43-60` declares English label maps against `src/components/EntryForm.tsx:34-46`
   in Vietnamese, a third copy of the same label sets, and its own developer wrote the handover into
   the file at `:40-42`. **OPS-002 is the ticket that reconciles all three.**

**Neither branch is `ops/<slug>`.** `feat/OPS-001` and `feat/OPS-002`, because
`scripts/check-allowed-paths.mjs:96-98` exits 0 with *"nothing to check"* on any branch not beginning
`feat/` — so an `ops/` name would run RULE-03 unenforced across shipped application files. That is the
same trade-off the operator settled for `feat/BUG-001` on 2026-09-03, and the residual contradiction
with `git-conventions.md:36` is recorded in each ticket's §4 rather than reopened.

**CORRECTION, `orchestrator` at /ship on 2026-09-03 — the two rows above are now 12 and 13, and the
paragraph that opens this block is left standing rather than rewritten.** It says *appended at rows 13
and 14* and *nothing was renumbered*, and both were true when `product` wrote them: CAL-03 was still
row 1. CAL-03 shipped in the same hour and left this table, so every row below it moved up one.
**Bookkeeping, not a reordering** — no row moved relative to another, and `product` still asserts
nothing about their position.

**Their point 2 is overtaken: `depends_on: [CAL-03]` now passes Definition of Ready item 3**, because
CAL-03 is `DONE`. The file collision it describes is spent — CAL-03's `allowed_paths` are released and
its five contested files reach `main` with [#38](https://github.com/didi-code0980/calechip/pull/38).
**Point 1 is untouched and is the one that still blocks:** both tickets rest on `§ Language` in
`.ai/standards/ui-design-system.md`, which exists only in commit `3ccbd37` on `ops/ui-language-english`,
open as PR #37 and unmerged. If #37 does not merge, both tickets are invalid rather than blocked. No
ticket field carries that, which is why it is prose — and why nothing in the loop will ask.

**Renumbered to 1–9 by `orchestrator` at /ship on 2026-09-04**, when CAL-06 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **ADM-01 is now row 1** — the first non-CAL row to reach
the top of this list, and it is unblocked: its `depends_on` gained CAL-04 in #45 and CAL-04 shipped
in #48. The CAL group is down to CAL-07 and CAL-08, both of which wait on things ADM rows own.

**Renumbered to 1–10 by `orchestrator` at /ship on 2026-09-04**, when CAL-05 left this table for
`## ARCHIVE`. Bookkeeping, not a reordering. **The whole range was renumbered this time, OPS-002
included** — the correction below explains why that is worth saying.

**CORRECTION, `orchestrator`, 2026-09-04 — OPS-002 is row 11, not 12.** The CAL-04 ship below
renumbered the rows only as far as ADM-06 and left OPS-002 where it was, so the table read 1–10 and
then 12 with no row 11. Fixed while resolving this branch against `main`. Bookkeeping, not a
reordering: OPS-002 has not moved relative to any row, it was simply numbered wrong for one commit.

**Renumbered again to 1–10 by `orchestrator` at /ship on 2026-09-04**, when CAL-04 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-05 is now row 1**, and ADM-01 — row 3 — is
newly unblocked in fact rather than on paper: its `depends_on` gained CAL-04 in #45 precisely because
CAL-04 owns the `team` select policy, and CAL-04 has now shipped it.

**Renumbered again to 1–12 by `orchestrator` at /ship on 2026-09-03**, when CAL-02 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-03 is now row 1 and is blocked on nothing** —
its `Blocked on` names CAL-02, which is now DONE.

**Renumbered again to 1–13 by `orchestrator` at /ship on 2026-09-03**, when CAL-01 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-02 is now row 1 and it is blocked on nothing**
— its `Blocked on` names CAL-01, which is now DONE.

**Renumbered again to 1–14 by `orchestrator` at /ship on 2026-09-03**, when TEA-05 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-01 is now row 1**, and it is there because
every row a human placed above it has shipped — not because anyone moved it.

**The rows above were renumbered to 1–15 by `orchestrator` at /ship on 2026-09-03**, when BUG-001
left this table for `## ARCHIVE`. **Bookkeeping, not a reordering** — no row moved relative to
another, and TEA-05 is row 1 again by the same operator placement recorded below, not by a new one.

**The operator placed TEA-05 at row 1 on 2026-09-01**, and the fourteen rows below it moved down one.
That is a reordering, not the bookkeeping renumbering described below — a human moved a row relative
to the others, which is the only way that is allowed to happen.

*The paragraph below was written by `product` when the row was appended, and is kept because it names
the two facts the reorder rested on.* **TEA-05 was appended, not inserted.** This file's header says
it is an ordered list that a human reorders, so placing the row anywhere above 17 would have
renumbered sixteen rows a human placed. `product` asserts nothing about its position. Two facts a human reordering it should have:
`depends_on` is `[TEA-01]`, which is `DONE`, so nothing blocks it; and no row above it names TEA-05
in `Blocked on`, although each of them describes something a signed-in person does.

**The rows above have been renumbered twice by `orchestrator` on 2026-09-01** — to 1–16 when
TEA-03 left this table for `## READY`, and to 1–15 when TEA-04 did. `product`'s paragraph is left as
written; read its *17* and *sixteen rows* as the positions at the time it was written. TEA-05 is now
row 1, placed there by the operator on 2026-09-01. **The renumbering is
bookkeeping and never a reordering** — no row has moved relative to another since a human placed it.

**BUG-001 was appended at row 16 by `product` on 2026-09-01, and `product` asserts nothing about its
position.** Same stance as the TEA-05 paragraph above: this file's header says a human reorders, so
placing a row anywhere above 16 would have moved fifteen rows a human placed. The fact a human needs
in order to place it: **ADR-021 §Consequences requires this ticket ahead of CAL-01, which is row 2**,
and states why in its own words — *"Until it lands, no ticket can pass the QA gate, because Definition
of Done item 3 requires the suites to exit 0."* Item 3 was suspended under ADR-017 and is restored by
ADR-021, so this is not a preference about ordering: **until BUG-001 lands, no ticket in this table can
pass the QA gate at all**, on any machine carrying a `.env`. It is `depends_on: []` and blocked on
nothing, so it can be placed anywhere. `.ai/board/tickets/BUG-001/ticket.yaml` §4 carries one thing a
human must settle before it starts, and it is not its position: the branch name.

**The operator placed BUG-001 at row 1 on 2026-09-01**, above TEA-05, and the fifteen rows below it
moved down one. That is a reordering, not the bookkeeping renumbering described above — a human moved
a row relative to the others, which is the only way that is allowed to happen. `product`'s paragraph
immediately above is left as written; read its *row 16* as the position at the time it was written.
The operator was asked because ADR-021 §Consequences requires this ticket ahead of CAL-01 while this
file's own header reserves reordering to a human, and those two are only reconcilable by asking.

**The branch name was settled in the same exchange: `bugfix/BUG_TEA-01_01`**, which is
`.ai/standards/git-conventions.md:32` followed exactly. The operator was shown, and accepted, that
`bugfix/` branches run with the RULE-03 path guard inactive in both resolvers
(`git-conventions.md:44-49`) and that this ticket edits shipped test files. `branch` is set in
`.ai/board/tickets/BUG-001/ticket.yaml`; the guard consequence is recorded there in §4 so that
whoever runs `/implement` reads it rather than rediscovering it.

**CORRECTION, `orchestrator` at /ship on 2026-09-03 — the branch is `feat/BUG-001`, and the paragraph
above is left standing rather than rewritten.** The operator superseded the 2026-09-01 choice on
2026-09-03, after `tech-lead-design` measured a fact that was not available at triage:
`scripts/check-allowed-paths.mjs:90` resolves a `feat/` branch to its ticket and finds
`.ai/board/tickets/BUG-001/ticket.yaml`, so the option triage had presented as *unavailable* is the
only one under which RULE-03 is enforced in CI — a `bugfix/` branch exits 0 saying "nothing to
check" (`:85-87`). So the guard consequence the paragraph above warns about **does not apply**:
`allowed_paths` is checked mechanically on this branch, and `/ship` step 6 is where that check runs
against the committed diff. The full record, including what the new name costs against
`git-conventions.md:36`, is the §4 CORRECTION block at the end of that `ticket.yaml`.

## BLOCKED

Tickets that cannot proceed until a human decides something. Name the decision, not the topic.

| # | Ticket | Blocked on | Since | Who decides |
|---|--------|------------|-------|-------------|

## ARCHIVE (last 20)

| # | Ticket | Title | Shipped | PR |
|---|--------|-------|---------|-----|
| 1 | OPS-001 | UI copy to English — chrome, account and team screens | 2026-09-03 | [#40](https://github.com/didi-code0980/calechip/pull/40) |
| 2 | CAL-04 | Month view — a day grid showing who is away and which days are overloaded | 2026-09-04 | [#48](https://github.com/didi-code0980/calechip/pull/48) |
| 3 | CAL-05 | Week view — per-person detail for one week, with half-days, notes and who approved | 2026-09-04 | [#49](https://github.com/didi-code0980/calechip/pull/49) |
| 4 | CAL-06 | Year view — one row per member across 365 days | 2026-09-04 | [#51](https://github.com/didi-code0980/calechip/pull/51) |
| 5 | ADM-01 | Set the overload threshold | 2026-09-05 | [#52](https://github.com/didi-code0980/calechip/pull/52) |
| 6 | CAL-07 | Overload warning shown while choosing dates, before the entry is saved | 2026-09-05 | [#53](https://github.com/didi-code0980/calechip/pull/53) |
| 7 | ADM-02 | The national holiday calendar, seeded and readable | 2026-09-05 | [#54](https://github.com/didi-code0980/calechip/pull/54) |
| 8 | ADM-03 | Add, edit or delete a holiday or swap day | 2026-09-05 | [#55](https://github.com/didi-code0980/calechip/pull/55) |
| 9 | CAL-08 | Holidays and bridge days shown in the calendar views | 2026-09-05 | [#56](https://github.com/didi-code0980/calechip/pull/56) |
| 10 | ADM-04 | The worklist of entries awaiting a decision | 2026-09-05 | [#58](https://github.com/didi-code0980/calechip/pull/58), merged — corrected from `PENDING_PR` at ADM-05's ship |
| 11 | ADM-05 | Approve or reject an entry, with a reason on rejection | 2026-09-05 | [#59](https://github.com/didi-code0980/calechip/pull/59) |
| 12 | ADM-06 | Reject several entries at once, with one reason for the batch | 2026-09-06 | [#60](https://github.com/didi-code0980/calechip/pull/60) |
| 13 | OPS-002 | UI copy to English — entry screens and the seam's error messages | 2026-09-07 | [#62](https://github.com/didi-code0980/calechip/pull/62) |
| 14 | UIE-01 | Restyle the sign-in and sign-up screens to the product's visual direction | 2026-09-07 | [#63](https://github.com/didi-code0980/calechip/pull/63) |
| 15 | UIE-02 | The application shell — a persistent sidebar and top bar | 2026-09-07 | [#64](https://github.com/didi-code0980/calechip/pull/64) |
| 16 | UIE-03 | The calendar screens give up their own chrome to the shell | 2026-09-07 | [#65](https://github.com/didi-code0980/calechip/pull/65) |
| 17 | UIE-04 | The week view as seven day columns | 2026-09-07 | [#66](https://github.com/didi-code0980/calechip/pull/66) |
| 18 | OPS-004 | A password-free bootstrap file that creates the first team and the first admin | 2026-09-07 | [#71](https://github.com/didi-code0980/calechip/pull/71) |
| 19 | UIE-05 | The week column fills the viewport, and its header strip and entry chip are restacked | 2026-09-08 | [#72](https://github.com/didi-code0980/calechip/pull/72) |
| 20 | UIE-06 | The month grid becomes one ruled full-width card with taller cells, on the product's tokens | 2026-09-08 | [#73](https://github.com/didi-code0980/calechip/pull/73) |

**The window displaced `CAL-03` at this ship** — *CAL-03, Edit or delete another member's entry, as an
admin, shipped 2026-09-03,* [#38](https://github.com/didi-code0980/calechip/pull/38). Reproduced on
ADM-06's convention.

**No rework, no consultation, no amendment, one review pass — the fourth such ticket in a row.** Two
files outside the ticket folder, no spec file opened, and `playwright test` returns 165 passed with
none modified.

***THIS ROW CARRIES THREE INVARIANTS — `[INV-04, INV-05, INV-06]`, the most of any ticket in this
product — AND EACH IS ENGAGED BY A DIFFERENT MECHANISM.*** None of them because the ticket changes any
arithmetic; `src/lib/data/absence.ts` is never opened.

- **INV-04.** The cell already shows one avatar **per member**, and that reads correctly *only*
  because the count beside them carries the arithmetic: an am+pm pair is one face and one whole day
  of count. Remove the count and the faces become the only reading available — a second, wrong
  definition of exactly the thing INV-04 exists to keep single.
- **INV-05.** The dashed reduced-opacity border is what shows an entry is tentative **while still
  being counted** — and **a ruled grid is precisely where a border treatment gets lost**, because the
  hairlines between cells are also thin lines. AC-14 states it as an outcome rather than a rule.
- **INV-06.** A half day's avatar is identical to a full day's on this screen, so **the count is the
  only surface on which INV-06 is visible here at all.** Distinct from INV-04: that one is the count
  *agreeing with* the faces; this one is the count being the only place a portion can be expressed.

**PLAN found a comment in `src/index.css:141-143` that refused a `--color-overload` token on three
clauses that were all false the day they were written.** `src/routes/MonthView.tsx:175` calls
`seam.getTeam()` and `:347` computes `isOverloaded` — verified at PLAN and again at REVIEW. The token
ships at `#ffe4e6`, **exactly today's `rose-100`**, so nothing changes visually: this is tokenisation,
not a colour decision. Without it the screen's one domain-bearing colour would have remained a raw
Tailwind default while six neighbours became tokens. The false comment is corrected in the same edit,
under the small-defect grant in `.ai/steward/context.md` § *Autonomy*.

***AND THE SAME FALSE CLAIM AT `src/components/Sidebar.tsx:63-64` WAS DELIBERATELY LEFT ALONE.***
Correcting a comment there would have put a **shell** file in `allowed_paths`, and RULE-03's guard
cannot distinguish a comment from a rewrite — the whole file becomes writable for the rest of the
ticket. §7.4 keeps the shell shut and `01-plan.md` *Open questions* reports the line instead. **It is
owed to a later ticket**, and it is the one item this ship added to the list under `## BACKLOG`.

**The window displaced `CAL-02` at this ship** —
*CAL-02, Edit or delete their own entry, shipped 2026-09-03,*
[#36](https://github.com/didi-code0980/calechip/pull/36). Reproduced on ADM-06's convention.

**No rework, no consultation, no amendment, one review pass — the third such ticket in a row.** One
file outside the ticket folder, no spec file edited, and all four commands re-run by the REVIEW
session on the final tree: `tsc` 0, `eslint` 0, `vitest run` 186 in 10 files, `playwright test` 165.

**PLAN corrected a claim in this ticket's own shell, and that correction is why `src/index.css`
stayed shut.** §3.4 called the card radius *"a token value, not a layout. Free."* **It is not free** —
`rounded-card` is shared by `AuthCard.tsx` (UIE-01's sign-in card) and `Sidebar.tsx` (UIE-02's shell)
as well as this screen, so moving `--radius-card` would have repainted two surfaces this ticket may
not touch. It is the same collision `src/index.css:117-123` already records for `--radius-lg`, one
token over. A Tailwind built-in went on the day column instead and AC-16 asserts both shared files
stay out of the diff.

**`invariants_touched` is `[INV-04, INV-06]` — two, where the shell proposed `[]` as the honest first
reading, and the second one is the find.** **The portion pill is INV-06's only visible surface in the
product.** A five-day `pm` entry is five afternoons, and the pill is how a reader sees that — and the
reference image **drops it**, which would have made the invariant invisible on the one screen that
shows it. AC-9 keeps it at rest, with `data-portion`. INV-04 repeats only UIE-04's *second* reason: no
number is added, but the presentation of the set that count sums is rewritten, and the tempting
space-saving at ~161px is merging a member's am and pm entries into one chip. AC-10 forbids it.

**No count was added or approximated while ADR-029 is still `PROPOSED`.** The refusal UIE-04
established holds, and the empty-state sentence stays with it — the two were never to be decided
independently.

**One declared deviation, and it was the plan's own to leave.** `01-plan.md` *Open question* 1
reserved the height declaration for a stage with a rendered viewport. `calc(100vh - 70px - 1.5rem)`
put the columns **56px below the fold** and made a quiet week scroll, because `seam-banner` renders
above the shell on every build the suite drives. `min-h-full` is offset-independent, lands on the
fold, and is a **minimum rather than a height** — so a busy column still grows past the pane, no
second scroller exists, and UIE-04's AC-4 and AC-5 are not reversed. Measured both ways in a rendered
viewport rather than reasoned about.

**The window displaced `CAL-01` at this ship, the seventh row out and the sixth in six ships** —
*CAL-01, Create an entry for themselves, over a range of dates, shipped 2026-09-03,*
[#32](https://github.com/didi-code0980/calechip/pull/32)*; board and registry in*
[#34](https://github.com/didi-code0980/calechip/pull/34). Reproduced on ADM-06's convention.
**The row that just went is the first CAL row and the oldest capability this product has** — every
TEA row has already left, so from the next ship the table starts eating the calendar. **Seven
reproduction paragraphs now stand where this table used to be the record.** MD-026 carries the
defect and names the two fixes; six ships have each chosen the prose rescue instead, which works
only for as long as an agent keeps noticing.

**The window displaced `TEA-05` at this ship, the sixth row out and the fifth in five ships** —
*TEA-05, Sign in, sign out, and the member-less landing state, shipped 2026-09-03,*
[#29](https://github.com/didi-code0980/calechip/pull/29)*; board and registry in*
[#30](https://github.com/didi-code0980/calechip/pull/30). Reproduced on ADM-06's convention. **Six
reproduction paragraphs now stand where this table used to be the record, and the window has
displaced a row at every ship since it filled.** The question first raised at ADM-06's ship has been
asked five times and answered none: either the heading grows, or something else becomes the permanent
record of what a ticket merged as. `metrics.md` has no PR column and cannot be it.

***THIS ROW EMPTIES THE BOARD.*** Twenty-six tickets, and `## BACKLOG` above is now an empty table for
the first time. What that means and what reopens the loop is written there rather than here.

**No rework, no consultation, no amendment, one review pass — the second such ticket in a row.**
`size: S`, **one file outside the ticket folder**: the shell already grants the pane full width and
every token the columns use shipped with UIE-01 and UIE-02, so `src/index.css` is untouched.
`ticket.yaml` §2 predicted two files and possibly four, and warned the §3 choice would move the cost
by more than the file count suggests. **It did, downward** — all three candidate spec files measured
out of scope, and not one test file is edited.

***THE ONLY TICKET IN THE `UIE` GROUP WHOSE `invariants_touched` IS NOT `[]`.*** It is `[INV-04]`,
exactly the exception §6 predicted against ADR-028's note that `[]` would be the answer on almost
every UIE row — recorded there as a **cost** of the group rather than permission to skip the question,
and this row is what that note was for.

**PLAN refused even triage's own recommendation, and that is the finding worth keeping.** §4 offered
the footer the day's own chip count as a safe substitute for `n/total vắng` — no arithmetic, no roster
read, no team call. **It is not safe.** A day holding one full-day entry and two half-day entries has
**three chips** and an absence count of **two**, so the footer would contradict the month grid for the
same date. **That is the second definition INV-04 exists to forbid, reached without ever opening
`absence.ts`** — which is precisely the shape CAL-04's row spent its whole length warning about. AC-13
adds no count at all, so §4's stop-and-ask never fired, `requires_adr: false` holds, and **no
amendment is owed to CAL-05's registry row**.

**Of §3's three options the plan took Option 3's breakpoint with Option 1's overflow behaviour**,
because neither answers both questions alone — Option 3 says what happens on a narrow viewport and is
silent about a full column on a wide one, Option 1 the reverse. **Option 2 was refused outright**: it
would have deleted `week-row-note` and `week-row-approver` from the resting view, which CAL-05's AC-6
and AC-7 assert, and pulled that spec file in behind them.

**1280px is originated here and is the product's first breakpoint.** `01-plan.md` *Open questions*
item 1 says the number is the one most worth arguing with, and that a later screen will inherit it by
copying rather than by reading a standard — **the same accumulation `§ Colour` and `§ Type` began at
UIE-01**, now with a third value in it. The BACKLOG section above records it as one of the three
things waiting for `/triage`.

**Two things the plan recorded rather than resolved**, both honest and neither blocking: the wrapped
column header's height at ~161px is still unmeasured — `ticket.yaml` §3's `TODO(verify)`, inherited
because it needs a rendered viewport, and it makes a column taller rather than shorter so AC-4's *the
page scrolls* absorbs it; and §8's first rejected alternative is **doing nothing**, argued seriously,
because the seven-column layout is not obviously better than the stacked one on a busy week.

**The window displaced `BUG-001` at this ship, the fifth row out and the fourth in four ships** —
*BUG-001, The end-to-end suite does not pin which seam it drives, shipped 2026-09-03,*
[#27](https://github.com/didi-code0980/calechip/pull/27)*; board files in*
[#28](https://github.com/didi-code0980/calechip/pull/28). Reproduced on ADM-06's convention. **This
one is the costliest displacement yet**: BUG-001 is the pair of pull requests ADR-023 exists because
of, and this table was the only file naming both. Five reproduction paragraphs now stand where the
table used to be the record.

**The cleanest run in the UIE chain, and the first ticket since ADM-06 to need no rework, no
consultation and no amendment.** One review pass, and **all four commands were run at REVIEW on the
final tree** — `tsc` 0, `eslint` 0, `vitest run` 186 in 10 files, `playwright test` 165 passed in
23.8s. The reviewer states in its own words that a verification table copied from the artifact being
judged is not evidence, and ran them itself.

**PLAN overrode §7 of this ticket's own shell, on the authority of a later document, and that is the
finding worth keeping.** §2 and §3 of the shell assume UIE-02 relocated the screens' selector ids
onto the shell. **It did not** — UIE-02 shipped `shell-period-*` names and left `data-period-kind` on
its anchor rather than `data-week-start` / `data-month` / `data-year`, deliberately, because while
both copies existed a reused id resolved to two nodes and Playwright's strict mode fails rather than
picking one. **UIE-02's `01-plan.md` § 4.8 handed the decision here in as many words**, so
`src/components/TopBar.tsx` and `src/lib/period.ts` came into scope against §7. Without that grant,
deleting four screen headers destroys **83 spec references**.

**Six spec files in `allowed_paths` — the most of any ticket in this product — and twelve paths is
M's ceiling exactly.** `tests/e2e/adm-01-threshold.spec.ts` is named in the shell specifically to be
**excluded**: it references two touched ids and both survive, so a reader who counts seven files
referencing a touched id knows why only six were edited. That is the shape of a scope statement that
expects to be checked rather than believed.

**`shell-period-prev`, `shell-period-next` and `shell-period-anchor` cease to exist three tickets
after UIE-02 named them.** Nothing asserts them, so the cost is documentary rather than behavioural —
but UIE-02's plan § 4.8 now reads as describing selectors that are gone. **That is what a superseded
plan looks like, and it is deliberately not amended backwards**, on the same principle every
corrected-in-place paragraph in this file follows.

**One open consequence, recorded by PLAN rather than fixed:** the holidays screen is now the only
period-shaped screen still carrying its own controls, which is a visible inconsistency inside a
ticket whose purpose was consistency. Teaching `period.ts` a `holidays` kind would close it in one
place, and that is a later ticket's.

**The window displaced `TEA-04` at this ship, the fourth row out and the third in three ships** —
*TEA-04, Remove a member, and promote a member to admin, shipped 2026-09-01,*
[#20](https://github.com/didi-code0980/calechip/pull/20). Reproduced on ADM-06's convention. **Four
reproduction paragraphs now stand between this table and the record it used to be**, and the question
first raised two ships ago has not changed: either the heading grows or something else becomes the
permanent record of what a ticket merged as. `metrics.md` has no PR column and cannot be it.

**`src/routes/Home.tsx` is deleted by this ticket** — the nav hub becomes the shell. **The twelve
`home-*` selector ids relocate UNRENAMED** into `Sidebar.tsx` and `TopBar.tsx`, which is what keeps
fifteen spec files passing unedited, and it is the reason this is M rather than L. Each of the 27 ids
was counted rather than asserted to have exactly one definition site, so nothing doubles under
Playwright's strict mode.

**One spec file is in `allowed_paths`, added at PLAN rework 1, and it is the only one this ticket
ever touches.** `tests/e2e/cal-03-admin-edit-entry.spec.ts:493` asserted **page-wide** that an entry
owner's display name is absent from a refusal screen — and the sidebar roster now names every active
member on every screen. The assertion is re-scoped to the content pane and its stated intent is kept
exactly: the roster is a read that *Read the member list* grants a member outright, so nothing is
disclosed that a policy withholds.

**Four statements in the shell went stale between triage and PLAN, and PLAN corrected each in place
rather than deleting it.** ADM-04, ADM-05 and ADM-06 are `DONE`, so §9.2's factual premise — *no route
is registered, no component exists* — is gone; **its conclusion survives for a different reason**, which
is that ADM-04 shipped its own link and that link relocates into the sidebar with the other eleven.
There are twelve `home-*` ids, not eleven. Fifteen spec files address one, not twelve — and §5 named
`cal-03-team-entries.spec.ts`, which does not exist. There are five membership guards on routes, not
four, and every line number in §3 is stale.

**One PLAN rework and one REVIEW rework, and only the second is charged.** PLAN rework 1 added the
spec file to `allowed_paths` and cost no `rework_count` — the defect was the plan's. REVIEW pass 1
(13:45) failed on §4.7's gutter, which is the Developer's, so `rework_count: 0 → 1` under RULE-08.
Pass 1's second finding was an AC-versus-code disagreement about `/week` addresses that the Developer
**routed rather than resolved** — both forms reach the same seven-day windows in the same order, so it
was a contract question and not a bug; `tech-lead-design` closed it at 14:20.

**The product shows two names, and this ticket makes a one-screen inconsistency a whole-product one.**
`index.html:6` and `CLAUDE.md` say *CaleChip*; UIE-01 built the auth card as *Ai Nghỉ?*; the sidebar
brand lockup now repeats that string on every screen. **§9.1 binds this ticket to whatever UIE-01
settled, so it followed rather than decided** — and it is one string in one file whichever way the
operator goes. `01-plan.md` *Open questions* item 1.

**The window displaced `TEA-03` at this ship, the third row it has pushed out** — *TEA-03, Team
member list, shipped 2026-09-01,* [#17](https://github.com/didi-code0980/calechip/pull/17). Content
reproduced on the convention ADM-06's ship established. **The question two ships ago called "two rows
old" is now three, and the interval between displacements is one ship**, which is what a rolling
window does once it is full. Either the heading grows or something else becomes the permanent record
of what a ticket merged as; `metrics.md` has no PR column and cannot be it.

**UIE-01 is the first `UIE` row to ship, and the first ticket in this product to deliver no
capability, no behaviour change and no test file at all.** OPS-001 and OPS-002 shipped no capability
but rewrote strings the suites assert on; this one changes appearance only. **Thirteen `data-testid`
names frozen and both acceptance suites passing unedited is what kept it at M rather than L** — rename
one selector and it becomes 5 source + 12 spec files, which is L and must split. That constraint is
written as AC-10 and asserted by AC-18.

**`size_estimate: S` against `size: M` is ADR-012 working, not a defect.** The whole gap is the six
`.woff2` files that `public/fonts/**` resolves to: an estimate that counts *surfaces* does not see
font binaries. The verdict wins and PLAN proceeded, which is the case that ADR's own *What this
decision does not change* names in so many words.

**One rework cycle, and the finding was the implementation's rather than the plan's** — so RULE-08
charges it, unlike OPS-002's amendment. REVIEW pass 1 (09:52) failed R5: the plan's vertical rhythm
specified 24px above the error paragraph and above the button, both shipped at `gap-4`'s 16px, and
the impl log had restated the contract row with those two values removed rather than declaring a
deviation. Pass 2 measured 24/24/24/24. **The correction went onto the shared constants rather than
onto the two screens**, so they cannot drift on a spacing value.

**One `TODO(project):` on this row is discharged by a decision and one is not.** The font: PLAN took
the self-hosted `@font-face` path — the only one of three needing no ADR — and the Developer obtained
six `.woff2` files rather than reaching for a CDN, so `requires_adr: false` is *true* rather than
merely unchanged. **The other stays open and is the operator's:** `§ Colour` and `§ Type` in
`.ai/standards/ui-design-system.md` are still bare stubs, so `src/index.css` is now the product's
de-facto palette and type scale **with no standard behind it**. UIE-02 is the next row and it has
nothing to conform to. Writing those two sections is human plane under RULE-01 and belongs to
`/thuki` on an `ops/<slug>` branch, not to a ticket.

**The window displaced `TEA-02` at this ship, the second row it has pushed out.** The heading says
*last 20* and OPS-002 is the twenty-first, so the oldest left the table. **Its content is reproduced
verbatim here, on the convention ADM-06's ship established one row earlier** — *TEA-02, Manage the
allow-list, shipped 2026-09-01,* [#13](https://github.com/didi-code0980/calechip/pull/13). The
paragraph below asks whether this heading should grow or whether something else should become the
permanent record of what a ticket merged as; **that question is now two rows old and still the
operator's.** It costs nothing until the day a reproduction paragraph is missed.

**OPS-002 empties the `copyDebt` ratchet, and that is the whole of what it delivers.**
`ui-language.json` goes from five files to `[]`. Twelve files predated `§ Language`; OPS-001
translated seven on 2026-09-03 and this ticket translated the last five, so the list reaching zero is
the standard's own stated proof that the sweep is complete. **The five leave the lint rule's `ignores`
and come under it**, which is what makes the ratchet unable to slip back — `eslint.config.js:84`
spreads `COPY_DEBT` into `ignores`, so an emptied list is an enforced list rather than a claim.
Adding a file to it is now the only way it can change, and that is the failure mode rather than the
mechanism.

**Its `feature_ids` span two groups and every one of the seven rows was already `DONE`**, so
`/ship` step 3 wrote nothing at all to `.ai/registry/features.md` — the first ship with no registry
write since that column got a writer. The split rationale item 6 requires is `ticket.yaml` §5: the
two seam implementations duplicate their refusal literals by design and `tests/seam-parity.test.ts`
compares export names and arity only, so cutting the pair by feature group would have left a
one-sided translation that is green against every check this project has.

**One amendment, no rework, and the defect was upstream.** `01-plan.md` AC-10 emptied `copyDebt`
while AC-12 assumed the two `it.each` cases over that list would go vacuous — and Vitest 4 fails a
suite that registers no tests. `tests/ui-language.test.ts` was not in `allowed_paths`, so the
`developer` could not reach the one file that resolves it, stopped, and routed it through
`99-questions.md`. `tech-lead-design` amended §7 and restated AC-12; `allowed_paths` went eleven to
twelve, **which is M's ceiling exactly, with no headroom left**. RULE-08: no `rework_count`
increment, because the plan was wrong rather than the implementation.

**The window filled at this ship, and `TEA-01` is the first row it pushed out.** The heading says
*last 20*; twenty rows stood here and ADM-06 is the twenty-first, so the oldest left the table. **Its
content is reproduced verbatim here so that nothing this file recorded is lost to a renumbering** —
*TEA-01, Sign up and establish the member record, shipped 2026-08-31,*
[#11](https://github.com/didi-code0980/calechip/pull/11) *merged 16:49:02Z; board and registry in*
[#12](https://github.com/didi-code0980/calechip/pull/12) *merged 16:50:48Z.* From here every ship
displaces a row, and a displaced row's links exist in no other file — `metrics.md` carries TEA-01's
five transitions and has no PR column. **A rolling window that quietly drops evidence is worth a
human's decision rather than a convention**: either this heading grows, or something else becomes the
permanent record of what a ticket merged as.

**OPS-001 is the first ticket that ships no capability at all** — it translates the copy of seven
already-shipped screens and changes no behaviour. Its five `feature_ids` are all TEA rows, and four
of the five were already `DONE`, so `/ship` step 3 had almost nothing to write.

**The exception is TEA-02, and it was stale rather than open.** That row read `IN_PROGRESS` with a
Notes sentence saying *"PR #13 open"*. [#13](https://github.com/didi-code0980/calechip/pull/13) merged
on 2026-08-31, hours after that sentence was written, and nothing updated the row for three days —
the exact silent drift `/ship` step 3 names as the reason it is the column's only writer. It is
corrected to `DONE` here, on the fact of the merge rather than on this ticket's work.

**Its `gates:` block was already correct** — `plan` and `review`, no `spec`, `design` or `qa`. First
ticket to reach `/ship` that way, because `product` created the shell on 2026-09-03 from the current
template. The five before it were each created before 2026-09-01 and each had to be migrated by
whichever role noticed.

**ADM-03 is the first ticket where the bounded-chat channel did the job it was built for, and the
first plan to be amended by the question rather than by its author noticing.** At 10:35 the
`developer` found that `01-plan.md` §4.5 and §7 were wrong: both asserted
`tests/e2e/adm-02-holidays.spec.ts` would pass **unedited**, and both reasoned about **selector names
only**. Every selector does keep its name — that part was right — but ADM-02's AC-13 signs in as an
admin and asserts **zero buttons, zero textboxes and zero forms** on `/holidays`, and five of this
ticket's criteria each require one of those three, for that caller, on that screen. The contradiction
is total, and it was **measured rather than predicted**: the full acceptance suite ran
`134 passed, 1 failed` with that one test as the only failure.

**What makes it worth recording is what the developer did next, which was nothing.** RULE-03 forbade
the edit, so they stopped, wrote `99-questions.md`, and routed it — the routing table sends *R5
impossible as specified* to `tech-lead-design`, which amended §4.5 and §7 at 10:45, scoped to that one
retired criterion, `size` 9 → 10 and still M. **RULE-08: no rework charged**, because the defect was
upstream of the stage that hit it. `chat_budget` `developer->tech-lead-design` is 1 of 6 — the first
non-zero chat count on the board.

**`allowed_paths` therefore grew from nine to ten between the DoR grade and the ship, which is
exactly what the forbidden thing looks like.** `.claude/commands/ship.md` says a path outside the list
is fixed by taking the file out of the commit, *"never to widen `allowed_paths`"* — that prohibition
is on `/ship` widening the list to get past its own step 6. This is the opposite: PLAN amended its own
plan, before the edit was made, through the channel the model provides for it. The distinction is
worth keeping legible, because the two are indistinguishable from the diff alone.

**AC-13 was retired where it stood, not reworded.** ADM-02's suite now carries a comment block naming
the ticket that superseded it and where the replacement assertion lives — ADM-03 AC-6, in both the
browser suite and the seam test. Its other eleven tests pass with no character changed.

**ADM-02 is the first ticket whose branch had to be merged with `main` before `/ship` could write
the board.** `feat/ADM-02` was cut from `2515a84`, one ship before CAL-07 merged as
[#53](https://github.com/didi-code0980/calechip/pull/53), so the `backlog.md` and `features.md` on it
were the pre-CAL-07 versions — no CAL-07 archive row, `Status: PLANNED`, and ADM-01's row back to
`PENDING_PR`. Writing this transition on that base would have opened a pull request that **reverts a
merged ticket's board and registry rows**, silently if anyone resolved the conflict the wrong way.
`origin/main` was merged in first; no incoming file was dirty, so it applied clean. Nothing in
`.claude/commands/ship.md` contemplates this case, and it will recur every time two ships run before
the first PR merges.

**It also means REVIEW's exit-0 evidence no longer described the tree being shipped.** The review ran
on the pre-merge tree — `vitest run` 4 files / 81 tests, which is the pre-CAL-07 count. After the
merge that tree does not exist. `/ship` step 1 is skipped by standing operator instruction, but the
reason for skipping it does not hold when the shipper changed the tree, so the three fast commands
were re-run here: `tsc --noEmit` exit 0, `eslint .` exit 0, `vitest run` **5 files / 110 tests, 0
fail**. `playwright test` was **not** re-run and remains REVIEW's, on the pre-merge tree.

**No new invariant and no foreign key.** ADR-015 settled on 2026-08-31 that the calendar is national,
closing `data-model.md` OPEN QUESTIONS items 1 and 2 — so `holiday` has no `team_id`, and `depends_on`
carries TEA-01 and ADM-01 rather than anything holiday-shaped. This is the first ticket in weeks whose
DoR item 4 passed on an ADR linked at `/triage` instead of one discharged at PLAN.

**The seed is data, not a capability.** `20260905120100_adm02_holiday_seed.sql` is idempotent with
`on conflict (date) do nothing` — `do nothing` and not `do update`, so an admin's correction from the
actual government announcement survives re-application. Applying it is human, RULE-09. `supabase/seed.sql`
carries four synthetic rows for local work and is deliberately not the real calendar.

**Its review is the second of three to catch the review-report template and the first to cite the
other.** `.ai/templates/review-report.md` still ships `next_state: QA`, a state ADR-022 removed;
ADM-01's reviewer corrected it, CAL-07's copied it through, and this one corrected it while naming
ADM-01's as precedent. Two of three is not a control — the template is.

**CAL-07 is the ticket CAL-04 was designed for, and the design held.** CAL-04's registry row
argued its absence function had to be **pure and take rows** — `absenceCountsFor(entries, range,
roster)`, every fetch outside it — for one reason stated in advance: *a function that fetches its own
rows cannot be called with an unsaved entry*, and CAL-07's whole job is the count a day will have
**if the draft in the form is saved**. This is that call. `src/lib/draft-entry.ts` turns the unsaved
draft into an `Entry` row and hands it to the same function, so the prospective count is CAL-04's
arithmetic rather than a second one — and `tests/absence.test.ts` and `tests/seam-parity.test.ts`
pass **unedited**, which is what plan section 5 stakes INV-04's single definition on. Third consumer,
one implementation.

**Its `depends_on` deliberately excludes ADM-01, and that call also held.** The triage shell recorded
that the idea bundled the warning with the threshold setting — *"cannot ship honestly without the
second"* — and rejected it as a release-ordering claim rather than a dependency, since
`overload_threshold` is `not null default 0.5`. ADM-01 shipped first anyway, so the argument was
never tested; what it bought was that it did not have to be.

**The review's `next_state` reads `QA`, a state ADR-022 removed.**
`.ai/templates/review-report.md` still ships that value. ADM-01's reviewer hit the same template
hours earlier and corrected it in the artifact, naming the staleness; this one copied it through. The
gate is `PASS` and the lifecycle at `.ai/01-operating-model.md:36` is authoritative, so the ship is
unaffected — but the template is still producing a retired state and that is steward work.

**Definition of Done item 3 was NOT run at `/ship`**: the operator instructed step 1 to be skipped.
The exit-0 evidence is REVIEW's, from 01:27 on the same tree with nothing committed since —
`vitest run` 5 files / 108 tests and `playwright test` 108 tests, 13 of them this ticket's.

**ADM-01 is the first ADM row to ship, and the first ticket whose PLAN gate had to be run twice.**
The 2026-09-03 pass came back `gate: BLOCKED` — it could not tell whether ADM-01 was allowed to carry
`grant select on public.team` and `team_select_own`, because `features.md` assigns those to CAL-04
and moving that ownership is a registry edit under RULE-01. Nothing was decided to unblock it. CAL-04
shipped the two statements on 2026-09-04, and the question stopped existing: the second pass on
2026-09-05 dropped the select half, linked ADR-005 and ADR-014 for the update half, and passed. **No
rework was charged** — RULE-08, the block sat upstream of the plan rather than inside it.

**What ships is two statements and a screen.** A column-level `grant update (overload_threshold) on
public.team`, which is what withholds `name` from everybody — an RLS policy is row-level and would
otherwise turn *set the threshold* into *edit the team row*, and no permission row for renaming a
team exists anywhere — and `team_update_admin`, scoped to an admin of the caller's own team. No
trigger, unlike TEA-04: one writable column needs no sentence that `with check` cannot express.

**The threshold was unreachable until now.** TEA-01 created `overload_threshold` and revoked every
privilege on `public.team`, so `0.5` was the only value the product could ever hold — and since
CAL-04 that default has been shading real days in the month view. This is the row that turns a
hard-coded 50% into a team's own number.

**Definition of Done item 3 was NOT run at `/ship`**: the operator instructed step 1 to be skipped.
The exit-0 evidence is REVIEW's, from 00:36 on the same tree with nothing committed since —
`vitest run` 4 files / 81 tests and `playwright test` 96 tests, both reproducing the impl log exactly.

**CAL-03 completes the write path on `entry`: CAL-02 gave a member their own rows, this gives an
admin every row on their own team.** Two policies and nothing else — `entry_update_admin` and
`entry_delete_admin`, both `using (is_admin(uid) and the entry's member is on the caller's team)`,
the update one additionally `with check` on team so an admin cannot move an entry to another team.
No new grant (CAL-02's are role-blind and already held), no insert policy, no change to
`entry_enforce_decision()`, and CAL-02's policies untouched. **Approving and rejecting is not here** —
that is ADM-05, and this row deliberately stops at edit and delete.

**Its `gates:` block still carried the four pre-ADR-019 keys — the fourth ticket running.** TEA-05
was migrated at PLAN, CAL-01 at `/implement`, CAL-02 and CAL-03 at `/ship`: four tickets, three
roles, none of them instructed to. Every remaining shell created before 2026-09-01 is the same.

**CAL-06 is the third view built on CAL-04's absence function, and the claim that function was made
for now holds.** CAL-04's registry row argued the return type had to be a per-date series rather than
a scalar precisely so *"the year view never needs a second path"*. This is that year view, and it
extended the shared module again — `src/lib/data/absence.ts` +46/-0, no second arithmetic. Three
consumers, one implementation.

**AC-14 refuses a possibly-truncated read rather than under-reporting it.** 365 days is where the
PostgREST row cap does its worst: a capped read sums what it was given and produces a believable
wrong answer with no error anywhere. The `TODO(verify)` on the datastore's own `max-rows` is carried
forward rather than assumed away, and it is still owed.

**First ticket in seven whose `gates:` block needed no migration.** The unstarted shells were fixed
between CAL-05's ship and this one, so CAL-07, CAL-08, the six ADM rows and OPS-002 all carry the
correct two keys. The shells still holding `spec`/`design`/`qa` are all DONE, which ADR-022 keeps on
purpose.

**CAL-05 is the first consumer of CAL-04's shared absence function, and it extended it rather than
copying it.** `src/lib/data/absence.ts` gained 74 lines and lost 1; no second arithmetic was written.
That is the outcome CAL-04's registry row demanded and the one no test would have caught failing —
two copies pass the seam-parity check, agree with each other, and diverge only when one is edited.

**`schema_delta` was genuinely `none`, the second ticket running.** CAL-02, CAL-03 and CAL-04 each
arrived with Definition of Ready item 4 failing and had it discharged at PLAN by linking existing
ADRs. CAL-05 owed none: the schema it reads was already shipped, and PLAN did not discover otherwise.

**Eight `allowed_paths` and the diff was eight for eight**, with real headroom — unlike CAL-04, which
sat exactly on the split threshold.

**CAL-04 builds INV-04 rather than merely touching it.** The absence-count function is one pure
function in one shared module — `src/lib/data/absence.ts` — imported by both seam implementations and
reimplemented in neither, which is what the registry row demanded: two copies of that arithmetic
would agree until one was edited, and INV-04 would be violated with every test still green. It is
range-shaped, returning a per-date series rather than a scalar, so CAL-06's year view needs no second
path and CAL-07's warn-once-versus-warn-per-day question is settled by the return type.

**It also ships the `team` select policy and grant that ADM-01's plan asked to take.** #45 settled
that question two hours earlier — CAL-04 keeps it, because the registry's own rule is that the owner
should be the first consumer. This ticket is that first consumer, so `overload_threshold` is readable
for the first time and INV-04 is computable at all.

**Twelve `allowed_paths`, and the diff was twelve for twelve** — no path unused, none exceeded.
`size: M` was annotated *"exactly on the split threshold"*, and it held.

**CAL-02 is the first ticket to ship under ADR-023 — one pull request, not two.** The three
ship-owned paths (`backlog.md`, `metrics.md`, `features.md`) ride on the ticket branch, exempted by
name in `scripts/check-allowed-paths.mjs`. The three ships before it — BUG-001, TEA-05, CAL-01 — each
produced two pull requests that had to be merged together, and #29 merging before #30 is the
demonstration ADR-023 cites.

**Its `gates:` block still carried the four pre-ADR-019 keys and nobody had migrated it.** Third
ticket running, and a different role did it each time — `tech-lead-design` at PLAN for TEA-05,
`developer` at `/implement` for CAL-01, `orchestrator` at `/ship` here, none of them instructed to.
Every remaining shell created before 2026-09-01 carries the same four keys.

**Definition of Ready item 4 failed at BACKLOG and was discharged at PLAN by linking rather than
authoring.** `schema_delta` is not `none` — two policies, a column-scoped update grant excluding
`member_id`, `status` and `rejection_reason`, a delete grant, and a `create or replace` of the
INV-02 trigger — and PLAN linked ADR-005, ADR-014 and ADR-016, all already approved, then corrected
`requires_adr` from `false` to `true`.

**CAL-01 is the first ticket to ship a migration, and the first whose invariants are enforced by the
database rather than by code.** Five of the seven are touched — INV-01 by an exclusion constraint
over `date_range` (needing the `btree_gist` extension), INV-02 by a trigger, INV-03 by a check, and
INV-06 and INV-07 by the table's own shape. ADR-005 and ADR-011 are the linked decisions; ADR-014 is
why `schema_delta` could not be `none`. **One implement cycle, no rework, R1–R8 all PASS.**

**All four verify commands were re-run at REVIEW and exit 0** — typecheck, lint, `vitest run`, and
`playwright test` with 32 passing, which is this ticket's eleven plus the four earlier suites
unedited. `/ship` did not re-run them; the operator instructed step 1 to be skipped.

**TEA-05 completes TEA-01, and both feature rows go to `DONE` together.** TEA-01 delivered sign-up
only; the sign-in half was carved out at DESIGN on 2026-08-31 and reached a ticket a day later
(MD-017). `.ai/board/tickets/TEA-01/01-story.md:212` says the feature is delivered only when both
halves are DONE, so `/ship` step 3's singular *"this feature's `Status`"* is read as plural here —
the instruction predates any ticket carrying two `feature_ids`.

**TEA-05 carries a `qa` gate reading `FAIL`, and it is not a waiver.** `06-test-report.md` failed on
2026-09-01 because the end-to-end suite was unpinned and ran against the live Supabase project —
that is BUG-001, archived directly above, which shipped the same day this did. ADR-022 then removed
the QA stage, so nothing produces that gate any more. Cycle 2 re-ran all four commands on 2026-09-03
at exit 0, including `pnpm exec playwright test` with 21 tests. **One rework cycle**, and
`rework_count` was corrected from 0 to 1 at ship; nothing had incremented it.

**AC-3 and AC-8 have never been observed against a real Supabase project**, which `01-plan.md`
section 8.1 declares as the plan's own limit rather than a gap the implementation opened. MD-014 is
the standing proof that the difference is not theoretical: seeded accounts could not sign in at all,
and no test noticed for a day.

**TEA-01 shipped with its QA gate passed by operator waiver.** Ten of twelve acceptance criteria
have no test; `tests/permission-model.test.ts` does not exist because no database was provisioned.
Under ADR-005 the row-level policies are the entire authorization model, so what is unverified is the
authorization model. The waiver is marked `temporary: true` in `06-test-report.md` and is reversed by
deleting the `waiver:` block. The work that retires it honestly is *Appendix A* of `02-design.md`.

**TEA-02 shipped with its QA gate waived per ADR-017.** Acceptance criteria and policy enforcement
are untested by automated suites because no live test runner is configured.

**TEA-03 and TEA-04 shipped with their QA gates waived per ADR-017**, on the same terms. No test
plan, no test report and no test file exists for either.

**TEA-04 IS THE THIRD TICKET TO REACH DONE UNDER ADR-017, WHICH FIRES ITS REVERT CONDITION 2** —
*"Three tickets reach DONE under this waiver"*, counted from `metrics.md` archive rows. TEA-02,
TEA-03 and TEA-04 are the three. Reverting is registry work under RULE-01 and belongs to the
steward, not to `/ship`: ADR-017's `Status` becomes `SUPERSEDED`, *The QA stage is waived* comes out
of `.ai/01-operating-model.md`, and a ticket opens to retire the untested surface. Under ADR-005 the
row-level policies are the entire authorization model, so that surface is the authorization model
across three tickets. Nothing counts this automatically — MD-016.

**TEA-03 shipped with its QA gate waived per ADR-017.** Acceptance criteria and policy enforcement
are untested by automated suites because no live test runner is configured.

**`Blocked on` for ADM-01 gained CAL-04 by `orchestrator` on 2026-09-04, and no row moved.**
Bookkeeping plus one resolved decision, not a reordering. `.ai/board/tickets/ADM-01/01-plan.md`
carried `gate: BLOCKED` on a single question — whether ADM-01 ships the `team` select policy and
grant that `.ai/registry/features.md` assigns to CAL-04. **The operator delegated the answer and it
is no.** The plan's premise had gone stale: it argued from ADM-01 being backlog row 1 and CAL-04 row
7, and today CAL-04 is row 1 and ADM-01 is row 4, because CAL-01, CAL-02 and CAL-03 shipped and left
this table. The registry's own reason for the assignment — the owner should be the first consumer, so
the policy is exercisable at its own gate — therefore points back at CAL-04, which is who it already
names. **`.ai/registry/features.md` is unedited, because nothing in it is wrong.** ADM-01's plan must
be re-run to clear its gate; the read half its sections 4, 6 and 7 marked for striking is struck.

**ADM-05 is the fourth ticket running to reach `/implement` still reading `BACKLOG` with both gates
`false`, and ADM-04's own metrics row predicted it in terms** — *"Steward work, and it will recur on
ADM-05 unless something is given the write."* It recurred. No command in `.claude/commands/` owns the
PLAN -> READY transition: the loop at `.ai/01-operating-model.md:284-286` has it, `/next-ticket`
grades the Definition of Ready and writes no file **by design**, and `/ship` is where `state`,
`branch` and `gates.plan` are finally recorded. Four occurrences with a standing prediction attached
is no longer a note for a ticket shell; it is a defect in the model with a named owner and no ticket.

**Two stale `PENDING_PR` markers were corrected at this ship, on the fact of the merge rather than on
this ticket's work** — the same repair OPS-001's ship made to TEA-02, and for the same reason `/ship`
step 3 gives for being the column's only writer. ADM-04's archive row above and its `features.md` row
now carry [#58](https://github.com/didi-code0980/calechip/pull/58); CAL-08's `features.md` row now
carries [#56](https://github.com/didi-code0980/calechip/pull/56), which this table already had. Both
were written by a ship that could not know its own number, which is the structural cause: `/ship`
commits before it opens the pull request, so the row is true only if something comes back for it.

**This ship came back for its own, and that is the whole of the second commit on this branch.**
`git push --force` is denied in settings (`git-conventions.md`, *Two limits are not the
orchestrator's to weigh*), so amending was not available and the number could not have been known
one commit earlier. `.claude/commands/ship.md` says a ticket gets one commit; `git-conventions.md`
§ *What the orchestrator decides* leaves the count to the orchestrator. **ADR-023's invariant is one
pull request, not one commit**, and #59 is one pull request. The second commit touches two
ship-owned files and changes two strings. **The general fix is still owed and is not this**: either
`/ship` learns to write the row after `gh pr create`, or a check fails a `PENDING_PR` marker on a
ticket whose branch has an open pull request.
