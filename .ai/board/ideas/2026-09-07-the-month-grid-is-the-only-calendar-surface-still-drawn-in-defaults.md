---
stage: TRIAGE
agent: product
produced_at: 2026-09-07
inputs_read:
  - CLAUDE.md
  - .ai/steward/context.md (standing instructions in full; session log read in part)
  - .ai/templates/idea.md
  - the transcription named under Evidence, in full
  - .ai/board/ideas/2026-09-07-a-busy-week-does-not-fit-and-a-day-does-not-say-how-full-it-is.md
  - .ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md
  - .ai/board/tickets/UIE-05/design/README.md
  - .ai/registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md
  - .ai/registry/features.md (the CAL-04, CAL-05 and CAL-08 rows; the UIE group header and UIE-01..UIE-05)
  - .ai/registry/invariants.md (the seven rows)
  - .ai/standards/ui-design-system.md (§ Language, § Visual specification in full)
  - .ai/board/tickets/CAL-04/01-plan.md (AC-1..AC-14 and § Invariants touched)
  - .ai/board/tickets/CAL-04/03-impl-log.md (the selector table, by search)
  - src/routes/MonthView.tsx (in full, including the header comment block)
  - src/routes/WeekView.tsx (:298-369 in full; the rest by search)
  - src/routes/YearView.tsx (by search)
  - src/components/AppShell.tsx (in full)
  - src/components/Sidebar.tsx (:55-84)
  - src/index.css (the token block, by search)
  - src/lib/fixtures.ts (by search)
  - tests/e2e/cal-04-month-view.spec.ts (:195-239)
  - tests/e2e/adm-01-threshold.spec.ts (:212-229)
  - tests/e2e/cal-06-year-view.spec.ts (:383-393)
  - tests/e2e/cal-08-holiday-shading.spec.ts (by search)
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# The month grid is the most-used screen, and the only calendar surface still drawn in defaults

**This file is step 0 of `/triage` and carries no verdict.** The problem is written down before it is
judged; the verdict is written in a second dispatch, after `tech-lead-design`'s technical read.
**There is no feature ID here and none was allocated.**

**This is the operator's second image of the day.** The first produced
`.ai/board/ideas/2026-09-07-a-busy-week-does-not-fit-and-a-day-does-not-say-how-full-it-is.md` and
its carve-out `.ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md`. That run is the model
for this one, and its most useful habit is repeated here: **where a difference between the picture and
the screen is a preference rather than a problem, this file says so** instead of manufacturing a gap.

## Problem

The operator's request, verbatim, 2026-09-07: *"thay đổi UI của calendar month view like this design in
image"*. **What they handed over is a picture of an answer.** What follows is the question it appears
to be answering, stated against `src/routes/MonthView.tsx` as it stands in the tree today.

The month view is CAL-04's, shipped 2026-09-04 in PR #48. `CLAUDE.md` § *Visual direction* names it in
one sentence — *"the calendar grid is the most-used screen and information density wins there every
time"*. Four things about it are true right now.

**1. It is the one calendar surface the product's own palette never reached.** UIE-01 and UIE-02 put
design tokens in `src/index.css` — `--color-card`, `--color-line: #e4e0f4`, `--radius-card: 26px`,
`--shadow-soft`, and the three meaning-named fills `--color-pto: #ffcbaa`, `--color-wfh: #a9e2cd`,
`--color-holiday: #c9bff0` (`src/index.css:102-151`). UIE-04 converted the week view onto them
(`WeekView.tsx:350-357`: *"the tokens UIE-01 and UIE-02 shipped, in place of the three Tailwind
defaults CAL-05 had to use before they existed"*). **The month grid was never converted, and the reason
is recorded in its own file**: UIE-02's edit to this screen was `mondayIndex` and friends moving to
`@/lib/period`, and `MonthView.tsx:64-65` states the constraint that governed it — *"no rendered output
changes here, which is what keeps `Out of scope` item 1 true and zero spec files in scope"*. UIE-03's
edit was the same shape.

So the month cell is still `rounded-xl` with no shadow on `bg-white` (`:374`, `:385`), the holiday tint
is `bg-violet-100` (`:384`), the overloaded cell is `bg-rose-100` (`:379`), the out-of-month cell is
`bg-slate-100/60 text-slate-400` (`:375`), and the avatar chips are `bg-emerald-100` and `bg-orange-100`
(`:452`). **The consequence a person meets is that the sidebar's legend and the grid beside it state the
same three meanings in different colours.** `Sidebar.tsx:67-71` draws its swatches from `bg-pto`,
`bg-wfh` and `bg-holiday` — `#ffcbaa`, `#a9e2cd`, `#c9bff0` — and the cells the legend explains are
painted in Tailwind's `orange-100`, `emerald-100` and `violet-100`. A legend whose swatch is not the
colour on the grid is a legend that has to be interpreted rather than read.

**2. The grid is the only calendar view still capped, and it is capped on the screen where width is
worth the most.** `MonthView.tsx:314` is `mx-auto flex max-w-5xl` — 1024px, centred, inside a full-bleed
pane the shell grants at `min-w-0 flex-1` (`AppShell.tsx:36-42`). **UIE-04 deleted exactly this from the
week view and wrote down why**: `WeekView.tsx:304-305`, *"`mx-auto max-w-3xl` STOOD HERE and is gone:
seven columns need the pane's full width, which AppShell.tsx already grants."* `YearView.tsx:322` is
`max-w-full`. The month view kept the width it had when it was its own page with its own header, and
UIE-03 took the header away without touching the width. On the operator's viewport — the transcription
records ~1563px — seven columns share 1024px while roughly a quarter of the pane is empty on each side.

The height is the same story from the other end: a cell is `min-h-24` (96px, `:374`) against the
transcription's ~170px, so five or six rows of a month occupy about 600px of a ~1010px viewport. **The
densest screen in the product is drawn small in the middle of a screen that has room for more.**

**3. Nothing in this screen has a narrow width.** `:335` is a bare `grid grid-cols-7 gap-1` with no
breakpoint. UIE-04 originated the product's first breakpoint at `xl` / 1280px for the week view and
recorded that nothing in the repository had stated one before. The month grid predates that and never
got one, so below about 900px it is seven columns of roughly 100px each holding wrapping avatar chips.
The image is desktop-only and says nothing about this either way.

**4. Two facts on this screen are load-bearing and one of them is unenforced.** The cell renders a
visible absence count (`month-cell-count`, `:391-395`) and the header renders the threshold readout
(`month-threshold`, `:330-332`), and `:327-329` records why the second exists: *"an overloaded day is
otherwise a colour with no explanation, and the two numbers behind it are the whole of INV-04."* That
argument is stronger than it looks, because **the sidebar legend has no overload row and there is no
`--color-overload` token** (`Sidebar.tsx:63-66`, `src/index.css:141-143`) — so the soft pink cell has
exactly one explanation anywhere on screen, and it is that sentence.

**Not everything in the picture answers one of these, and saying which is which is the point of this
section.** The ruled hairline grid in place of gapped tiles, one card in place of forty-two, the weekday
strip lifted onto the page ground, ~170px rows, the avatar drawn as a filled circular chip, the card
radius — these are **arrangement preferences**. Several of them buy the density item 2 is about, which
is a real argument for them; none of them is a thing a person cannot do today. **Two other differences
are neither preference nor fix**: the picture *deletes* the count and the threshold readout, and it
spends lavender on a second meaning. Those are in § *Constraints already known*, because they are not
this idea's to settle.

## Who has it

- **Every member who opens the month, which is the product's headline screen.** Brief 7.1's default
  view, and the one `CLAUDE.md` § *Visual direction* singles out. Items 1, 2 and 3 are met on every
  visit.
- **Anybody comparing the sidebar legend with the grid** — item 1. The legend is permanently on screen
  beside the calendar (`AppShell.tsx:33-34`), so the two colour sets are visible simultaneously, which
  is the only situation in which a mismatch of this size is noticeable at all.
- **The operator, today.** They looked at the shipped month view and drew a different one. That is the
  strongest evidence in this file and also the least specific: it says the screen is not what they want,
  not which of the four items is why.

## Evidence

**Visual reference:** `/tmp/claude-0/-home-user-calechip/81a228c8-a342-5ee1-a6d6-0dd56dfd3585/scratchpad/transcription-month.md`

**What it is meant to settle:** the arrangement of the month grid — how the seven columns and five rows
divide the pane, whether the cells are ruled or gapped, where the weekday labels sit, how a day's
avatars are drawn, and what an out-of-month day looks like.

**Its status, exactly, because three different things are easy to confuse here:**

- **The image is the operator's, it was shown in conversation, and it is not on disk.** No image for
  this request exists anywhere in the repository, and nothing has been written to any ticket's `design/`
  folder.
- **The file at the path above is a hand transcription, not the image.** It was written for this triage
  by another agent, at a scratchpad path outside the repository, because there was no file to move. **A
  later reader cannot check a single sentence of it against the picture it describes.**
- **Where it ends up depends on the verdict** (`.ai/standards/ui-design-system.md:110-119`). On PROMOTE
  it becomes `.ai/board/tickets/<ID>/design/README.md` — the one canonical home, and the only path both
  `scripts/check-allowed-paths.mjs` and `.claude/hooks/guard-allowed-paths.mjs` exempt unconditionally.
  **On REJECT or NEEDS-ADR it stays here and specifies nothing**, because there is no ticket to specify
  (`:112`).

**The transcription is evidence of intent and it is not a specification.**
`.ai/standards/ui-design-system.md:137-138` — *"looks like the screenshot" is not an acceptance
criterion*, because it cannot be observed from outside the system by a reader who cannot ask a question.
`:125-129` is sharper: **no stage downstream ever reopens the reference**, there is no visual check at
REVIEW, none in CI, and no QA stage since ADR-022. `.ai/board/tickets/UIE-05/design/README.md`, written
hours ago for the other image, is the precedent for how this is labelled.

**The image was attached at exactly one stage and this is that stage** (`:103-106`, `:121-123`). If this
promotes, `/plan` must not be handed a second one.

**This is the fourth transcription in a row for this screen family and the first for the month view.**
The three before it were of the week and the shell.

**The rest of the evidence is source, read today rather than recalled**, and every claim in § *Problem*
carries its `file:line` there.

## Impact if ignored

- **The operator asked in words and a picture, and nothing in the loop would carry it.** There is no
  feature row, no ticket and no backlog entry for the month view's appearance. A request that reaches no
  artifact gets asked again — and it gets asked again after the next screen is built on the arrangement
  it disagrees with.
- **The legend and the grid keep disagreeing, and nothing will surface it.** No test asserts a colour;
  `.ai/standards/ui-design-system.md` § *Colour* is still a bare `TODO(project)`, which
  `src/index.css:145-148` records as the reason those token values have no document behind them. Item 1
  is invisible to every mechanism in this repository and visible to anybody who looks at the screen.
- **The picture decays first.** It exists in one conversation. Everything downstream works from a
  transcription written by an agent — and the places that transcription contradicts the registry
  (§ *Constraints already known*) then get resolved by whoever meets them first, in whichever direction
  is convenient at that moment.
- **The deletions are the cheap half of the picture and would go first.** Removing a number is a
  one-line diff and looks like tidying. `month-cell-count` is asserted by **no test in the repository** —
  the only references outside `MonthView.tsx:392` are `.ai/board/tickets/CAL-04/03-impl-log.md:169` — so
  its removal is silent. That makes it more dangerous to treat as a restyle, not less.
- **ADR-029 could be accepted and contradicted in the same week.** It is `PROPOSED` and proposes *adding*
  a per-day absence count to the week view. This picture *removes* the per-day absence count from the
  month view. Nobody has yet looked at both at once, and the loop has no stage that would make them.

## Constraints already known

Cited, not chosen. The first three are why this may not be a straight PROMOTE.

- **The image DELETES the per-day count, and that is an amendment to CAL-04, not a restyle.**
  `MonthView.tsx:391-395` renders `month-cell-count` whenever the count is above zero. The
  transcription's § 3 is explicit that the cell holds a day number and avatars and *"nothing else is
  written in the cell: no name, no count, no type label, no note."* CAL-04's AC-3 reads *"the cell for 14
  April **carries an absence count of 1.5**"* and AC-11 reads *"the screen shows a failure state and **no
  count is displayed**"* (`.ai/board/tickets/CAL-04/01-plan.md:83-87`, `:138-144`).
  **A precision that matters and that the verdict must rule on:** the cell also carries `data-count`
  (`MonthView.tsx:359`), and *that* attribute is asserted throughout
  `tests/e2e/cal-04-month-view.spec.ts` (`:211`, `:238`). So it is genuinely arguable whether AC-3 is
  satisfied by the attribute alone. **What is not arguable is that no acceptance criterion, and no test,
  would notice the visible number leaving.** Under `.ai/standards/ui-design-system.md:152-155` the Tech
  Lead's grant covers visual arrangement and *never* behaviour; removing a rendered fact is at the
  boundary and an idea may not move it.

- **The image also DELETES the threshold readout, and that one breaks a shipped test on another
  ticket.** `MonthView.tsx:330-332` renders `month-threshold`; the transcription's § 5 lists *"the
  overload threshold readout"* among the things the image does not show, and its § 2 top bar has no room
  for it. **`tests/e2e/adm-01-threshold.spec.ts:222-224` navigates from the admin threshold form to the
  month grid and asserts `month-threshold` carries `data-threshold="0.6"` and contains the text
  `60%`** — that is ADM-01's proof that a saved threshold reaches the calendar, and it is the only such
  proof. `tests/e2e/cal-04-month-view.spec.ts:224-226` asserts the same element for CAL-04 AC-14.
  And deleting it removes the soft pink cell's only explanation on screen: **the sidebar legend has no
  overload row** (`Sidebar.tsx:59-71`, deliberately, AC-11 and AC-20) and `src/index.css:141` records
  that there is no `--color-overload` token. **The image is internally coherent about this** — its
  sidebar adds a fourth legend row, pink, `Quá tải (>50%)` — but the sidebar is not this request's, so a
  month-only change taking the deletion alone leaves a colour nothing explains.

- **The count deletion is the exact mirror of ADR-029, and the tension is recorded here rather than
  hidden.** `.ai/registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md` is
  `PROPOSED — awaiting the operator`, from the operator's *other* image today, and proposes that the week
  view render `n/N` per day from `absenceCountsFor`. **Taking both would remove the number from the
  screen that has it and add it to the screen that does not**, on the same day, from two pictures by the
  same person. Whether that is coherent — the two screens are for different jobs, and a defensible
  reading exists in which each number belongs where the other picture puts it — is for the verdict and
  ultimately for the operator. The idea's obligation is only to refuse to let the two be decided in
  ignorance of each other.
  **A second-order consequence, stated because it is the argument ADR-029 turns on:** with the number
  gone, a month cell showing five avatars over a real count of 4.5 (one member on a half day, INV-06)
  offers no way to tell. That is precisely the chip-count confusion ADR-029 § *Rationale* option 3
  rejects outright for the week view.

- **A colour collision, one screen, one colour, two meanings.** The transcription's § 3 spends **pale
  lavender on out-of-month days** and its § 5 says plainly that no cell is lavender for being a holiday.
  `CLAUDE.md` § *Visual direction* says *"holidays are lavender"*, CAL-08 spends it there
  (`MonthView.tsx:384`, `bg-violet-100`, for a non-working holiday **and for nothing else**), and
  `MonthView.tsx:31-34` records the rule the colour encodes: *"lavender means NOT WORKING"*. The
  sidebar's third legend row says `Holiday` beside a lavender swatch (`Sidebar.tsx:70`). **The image's
  own sidebar keeps that legend row** — violet, `Ngày lễ` — while its grid spends lavender on days that
  are merely outside the month, so the picture contradicts itself as well as the registry. The shipped
  out-of-month treatment is grey (`:375`).

- **The `CẦU` badge changes the bridge day's colour and its language.** The transcription's § 3 has a
  small **filled pink** pill at the cell's top-right. The shipped badge is `Bridge`, **outlined**, no
  fill: `MonthView.tsx:417-423`, `border border-current`, with the reason at `:404` and `:31-34` —
  *"lavender means not working, and a bridge day is a working day that everybody is about to request"*.
  Filling it in pink borrows the overload colour for a working day and gives soft pink a second meaning
  on the same grid. CAL-08's registry row states the boundary as *"a bridge day is a working day and
  gets no lavender… the boundary a well-meaning developer will cross"*, and adds that changing what is
  drawn beside a day must never change what the day means.
  **And `CẦU` is Vietnamese.** `.ai/standards/ui-design-system.md:44-48` makes the interface English on
  **the operator's own instruction of 2026-09-03** (*"tôi muốn tất cả content đều là tiếng anh"*); it is
  lint-enforced, `copyDebt` is empty and only ever shrinks. **UIE-01 refused this, and the week-view
  triage refused it again today.** Every string in this image is Vietnamese too — `Tháng 04, 2026`,
  `Hôm nay`, `Tuần`/`Tháng`/`Năm`, the legend, `CẦU`.

- **INV-04, INV-05 and INV-07**, `.ai/registry/invariants.md:36-39`. INV-04 fixes one definition of the
  absence count and adds *"no second definition of this number exists anywhere in the system"*;
  `MonthView.tsx:10-14` states that this file computes none of its own and that a `.filter(...)` written
  here would be that second copy. INV-05 is why a tentative entry is drawn at all, and its treatment —
  the dashed border at reduced opacity, `:456` — is a thing the image does not show. INV-07 is engaged by
  the picture's sidebar, below.

- **INV-07 and the charter's one-team scope, again.** The transcription's § 1 records the same defect the
  week image had: **eight members carrying five different team subtitles** — Core Engineering, Frontend
  Team, Backend Team, QA / Testing, Design / Product. INV-07 is *"every entry belongs to exactly one
  member, and is counted only against the team that member belongs to"*, and the charter scopes this
  product to one team. **That is not a restyle; it is a different product.** The repository's fixtures
  hold **four** unremoved members of the main team (`src/lib/fixtures.ts:39`, `:72`, `:149`, `:319`;
  `:108` is another team, `:123` carries `removedAt`), so the picture's `TEAM (8)` is fictional and
  nothing may be asserted from it.

- **`.ai/standards/ui-design-system.md` § *Visual specification*, `:140-155`.** The grant to
  `tech-lead-design` covers the **visual arrangement** and the ACs that describe it, **and nothing
  else** — not behaviour, not permissions, not invariants, not feature IDs. The width, the ruled grid,
  the cell height, the weekday strip and the token conversion sit inside it. The two deletions and the
  lavender reassignment do not.

- **`CLAUDE.md` § *Visual direction*, as an argument in both directions.** *"Information density wins
  there every time"* supports the picture's taller cells and full-width grid; the same sentence is an
  argument against removing two facts from the cell, since density is about how much a screen says, not
  how little.

## Out of scope

- **Deciding any of the constraints above.** They are stated, not settled. Three of them are registry or
  acceptance-criterion matters and an idea may not resolve one.
- **The sidebar and the top bar.** The operator said *month view*. UIE-02 and UIE-03 shipped that chrome
  and it is largely as the picture draws it. Specifically **not** covered here: the `TEAM (8)` roster and
  its five team subtitles; the fourth legend row `Quá tải (>50%)`, which needs an `overloadThreshold`
  the shell does not read and would be the sidebar's second attempt at a row UIE-02 already deferred;
  the `▾` after the period title; the palette and sign-out icon buttons; the `Quản trị & Duyệt` pill;
  and the floating `?` button, which corresponds to no decision taken anywhere.
- **The week view and the year view.** Whatever is decided about a cell here does not travel to them by
  implication. `UIE-05` is already `PLANNED` against the week view and ships independently of this.
- **Vietnamese interface copy**, including `CẦU`, `T2`…`CN` and `Hôm nay`. Out on the terms UIE-01 set
  and the week-view triage repeated: it reverses a standard the operator themselves instructed, it is
  lint-enforced, and `copyDebt` only ever shrinks. If a Vietnamese interface is wanted, that is its own
  request with an ADR superseding § *Language*, product-wide, and not a property of the month grid.
- **Making the fixtures match the picture's roster of eight.** `src/lib/fixtures.ts` is § *Language*'s
  permanent `userContent` exception and is not this idea's to grow.
- **Filling § *Colour* and § *Type* in `.ai/standards/ui-design-system.md`.** Both are still
  `TODO(project)` stubs, both are human plane under RULE-01, and `src/index.css:145-148` already records
  that the shipped tokens have no document behind them.
- **The absence count itself.** Its definition, its arithmetic and where else it appears are INV-04's and
  ADR-029's. This idea observes that the picture deletes a rendering of it; it proposes nothing about the
  number.

### What the image does not show — carried from § 5 of the transcription, because silence is not removal

**Every one of these exists on the month screen today**, and a cell rebuilt from the transcription alone
would drop shipped CAL-08 and CAL-04 behaviour that spec files assert:

a holiday — no cell carries a holiday name, and no cell is lavender for being a holiday, since lavender
is spent on out-of-month days instead; the overload threshold readout; any selected date, or the
drag-select and create panel; the tentative treatment; the approved star; hover, focus, active or
selected states; a day with more avatars than fit on one line; any width narrower than desktop; dark
mode; and a month that needs six rows rather than five.

**Five of those are worth naming twice, because a spec file pins them:**

1. **The holiday name** — `month-cell-holiday`, carrying `data-kind` (`MonthView.tsx:407-416`), drawn
   for a row of **either** kind so a mandated working Saturday is named too, and drawn on an overloaded
   cell as well, because a signal hidden by a colour is the suppression ADR-015 forbids (CAL-08 AC-10).
2. **The lavender holiday tint and `data-day-status`** (`:365`, `:384`), asserted in
   `tests/e2e/cal-08-holiday-shading.spec.ts`.
3. **The bridge badge** — `month-cell-bridge`, outlined (`:417-423`), asserted at that spec's `:254-279`.
4. **The tentative dashed border at reduced opacity** (`:456`, CAL-04 AC-5, INV-05).
5. **The approved star** (`:460`) and the empty-month sentence `month-empty` (`:475-479`, AC-9, asserted
   at `tests/e2e/cal-04-month-view.spec.ts:176`).

**And one more of a different kind: the drag-select gesture** (`:371-372`, `:484-507`, AC-13). The image
shows no selected date and no form, and it is the only creation path on this screen. A grid rebuilt as
one ruled card must still carry `onMouseDown` and `onMouseEnter` per in-month cell.

## Open questions

Real ones. A verdict turns on the first three.

1. **Does the operator want the per-day count removed from the month cell — and do they want that
   knowing ADR-029 proposes adding the same number to the week view?** The two requests arrived hours
   apart from the same person. The question is one question and must be put once, with both pictures in
   view. **A month cell showing five avatars over a real count of 4.5 has no way to say so**, which is
   the confusion ADR-029 rejects for the week view in its own § *Rationale*.
2. **Does the threshold readout go, and if it does, what explains the soft pink cell?** Deleting
   `month-threshold` breaks `tests/e2e/adm-01-threshold.spec.ts:222-224` — ADM-01's only proof that a
   saved threshold reaches the calendar — and leaves the overloaded colour with no explanation anywhere
   on the screen, because the sidebar legend has no overload row and the image's fourth legend row is
   out of this request's scope. **Answering "yes, delete it" without answering the second half is how the
   pink becomes a colour nobody can name.**
3. **Which meaning gets lavender?** The picture spends it on out-of-month days; `CLAUDE.md`, CAL-08 and
   the sidebar legend spend it on non-working holidays, and the picture's own legend still says holiday.
   One colour cannot carry both on one grid. If out-of-month is to be tinted at all, it needs a colour
   that is not one of the four the product has already assigned a meaning to — and there is no
   § *Colour* standard to take one from.
4. **Is the operator asking for the arrangement, or for the arrangement plus the three reversals it
   carries?** The most likely reading is that the picture is about how the grid looks and not about its
   copy, its badge fill or its deletions — and that is still a guess. It is one question with several
   parts and it decides whether this is a restyle, an amendment to shipped criteria on two tickets, or
   something between.
5. **What does a cell do when a day has more avatars than fit?** The transcription's busiest cell holds
   six, at ~170px. The fixtures hold four members, so nothing in the picture and nothing in this
   repository exercises the case. The same objection was made of the week image this morning and it is
   the same objection: **the picture cannot contain the case that the layout has to survive.**
6. **Does the month grid get a narrow-width layout, and is it UIE-04's `xl` breakpoint or a new one?**
   The screen has none today and the image is desktop-only, so this is a gap in both.
7. **Does the drag-select gesture survive a ruled single-card grid unchanged?** It is CAL-04 AC-13 and
   the only way to create an entry from this screen. The image shows neither the gesture nor its panel.
8. **Will the image be attached to the repository, or does this proceed on a transcription?** There is no
   file to move. Under the second reading, the reference is prose written by an agent about a picture
   nobody can reopen — which is a different thing from an image the operator supplied, and
   `.ai/standards/ui-design-system.md:140-150` then places the layout under the Tech Lead's grant, **with
   the obligation that `01-plan.md` § 2b says so in a line.**
