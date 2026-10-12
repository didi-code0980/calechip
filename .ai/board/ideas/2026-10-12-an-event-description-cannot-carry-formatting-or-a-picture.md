---
stage: TRIAGE
agent: product
produced_at: 2026-10-12T09:52:56Z
inputs_read:
  - CLAUDE.md
  - .ai/registry/features.md
  - .ai/templates/idea.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260926140000_solo_issue_report_images.sql
  - supabase/functions/send-event-email/
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: ""
verdict_reason: ""
ticket_id: ""
awaiting_adrs: []
operator_request: "tôi muốn thêm 1 số function cho tính năng evt. Lúc tạo event, phần description sẽ là dạng 1 bài post (blog). cho phép user viết bằng Text editor có thể in đậm, in nghiêng,... và chèn ảnh nhưng lúc lưu sẽ lưu thành dạng text thuần (mã HTML)"
---

# An event description cannot carry formatting or a picture

**No verdict is written here.** This file is capture, not judgement. The verdict and any registry row
that follows one are written by `/triage`.

## Problem

*Derived from the request above; the operator stated a solution, not a problem.*

An event's description is a plain `text` column (`public.event.description`,
`20260929120000_evt01_event.sql:65`). The form edits it in a textarea (`EventEditor.tsx:453`), and
both the detail page and the guest page print it as `whitespace-pre-wrap` text
(`EventDetail.tsx:198`, `GuestEvent.tsx:207`). A creator announcing a gathering cannot make anything
stand out: no heading, no bold, no list, no link, no picture. The invitation reads as one block of
text, and the poster or venue photo that would carry it has to go out separately, through chat.

## Who has it

Every member who creates or edits an event, each time they write its description. Every reader of
that event, which since `EVT-06` includes anonymous guests on the guest page.

## Evidence

The operator's request, verbatim above. Asked at `/idea` on 2026-10-12. Each answer is the option the
operator picked, verbatim.

**Q1: unsanitised HTML is an XSS hole.** The description is shown to every member and to anonymous
guests. A: sanitise at render, through an allow-list of the tags the editor produces (a new
dependency, one shared component for every surface). B: as A, plus sanitise before saving. With no
server (ADR-005) that extra layer runs only in the client and can be bypassed by calling the API
directly, so the real layer is still the render.
**Answer: "B: Lọc cả khi lưu".**

**Q2: where pictures are kept.** A: a new public-read Storage bucket, with only the URL in the HTML;
B: embedded as base64 inside the HTML, no bucket, rows grow by hundreds of KB to several MB per
picture; C: paste an existing URL only, no upload.
**Answer: "B: Nhúng base64".**

**Q3: which formatting.** Multi-select. Offered: bold, italic, underline, strikethrough; H2/H3 and
bulleted and numbered lists; links opening in a new tab; blockquote, text colour, alignment.
**Answer: "cân nhắc dùng editorjs.io, Đậm/nghiêng/gạch chân, Tiêu đề + danh sách, Link, Trích
dẫn/màu/căn lề"**, i.e. all four groups, with Editor.js offered for consideration. Q5 settles the
editor.

**Q4: existing plain-text descriptions.** A: a migration wraps old text as HTML (escaped, line
breaks to `<p>`/`<br>`), so every description is HTML from then on; B: no migration, and two render
paths that guess.
**Answer: "A: Migration chuyển đổi".**

**Q5: Editor.js stores JSON blocks, not HTML.** Its core has no underline, colour or alignment.
A: an editor that writes HTML directly (e.g. Tiptap), matching "lưu thành text thuần HTML", which
re-opens losslessly; the library is PLAN's. B: Editor.js, converting JSON to HTML on save, which
re-editing parses back lossily and needs 3–4 community plugins. C: Editor.js storing both JSON and
HTML, a new column.
**Answer: "A: Editor xuất HTML".**

**Q6: base64 weight.** Lists and the week and month grids read the event row. A: the browser
downscales pictures (e.g. max 1200px wide, JPEG/WebP) before embedding, plus a total cap on the
description checked by the database. The exact numbers are PLAN's. B: no limit.
**Answer: "A: Nén + trần tổng".**

**Q7: the description in event email (EVT-05, EVT-08).** A: no, mail stays as it is; B: yes,
sanitised, with Gmail stripping base64 pictures and clipping past ~100 KB.
**Answer: "A: Không".**

## Impact if ignored

Creators keep writing descriptions as a single block of text and send posters through chat. The
guest page, the only thing an outside invitee sees, stays the plainest page in the product.

## Constraints already known

- **The editor writes HTML, and `public.event.description` stores that HTML as text** (the request,
  Q5-A). No JSON, no second column.
- **Sanitising at render is the security layer.** One shared component, an allow-list matching
  exactly the Q3 formats plus `img` with `data:` image sources only. It must be used by every surface
  that shows the description: `EventDetail`, `GuestEvent`, and any surface PLAN finds. The
  sanitise-on-save the operator chose (Q1-B) is defence in depth. ADR-005 means it runs in the
  client and cannot be trusted alone. Whether the database can add anything (e.g. a size check)
  is PLAN's.
- **The guest page is anon-readable** (ADR-052). Whatever the sanitiser lets through reaches the
  internet. ADR-052 revert condition 1 is about *which* data anon reads, not its markup, so it is
  unaffected.
- **Pictures are base64 `data:` URLs inside the HTML** (Q2-B). No Storage bucket and no new anon or
  Storage policy. They are downscaled in the browser and capped in total (Q6-A).
- **A new runtime dependency or two** (the editor, the sanitiser) under `.ai/standards/tech-stack.md`.
  Whether that needs an ADR is for `/triage` to judge.
- **Existing rows are converted by a migration** (Q4-A). Plain text is HTML-escaped, so no existing
  description can become markup.
- `send-event-email` does not read the description and keeps not reading it (Q7-A).
- INV-04, INV-05 and INV-07 are not engaged. An event is not an entry.

## Out of scope

Each item was decided against at `/idea`:

- **A Storage bucket or image URLs** (Q2-B).
- **Editor.js, or storing JSON** (Q5-A).
- **Two render paths for old and new descriptions** (Q4-A).
- **The description in event email** (Q7-A).
- **An unlimited description or full-size pictures** (Q6-A).
- Tables, code blocks, embedded video, mentions, or any format not listed in Q3.

## Open questions

None the operator owns. Assumptions this file made rather than asked, each cheap to reverse and each
PLAN's to overrule:

1. **The same editor is used to create and to edit** an event, and admins edit with it as they edit
   any event today (ADR-045 decision 5).
2. **Compact surfaces** (lists, the week and month grids, notifications) **never render the HTML.**
   Where they show anything from the description, it is a plain-text excerpt. PLAN may also stop
   lists from reading the column at all, because base64 makes it heavy.
3. **Links open in a new tab with `rel="noopener noreferrer"`**, and only `http`, `https` and
   `mailto` hrefs pass the sanitiser.
4. **The editor's look follows `CLAUDE.md` § *Visual direction*.** The toolbar layout is
   `tech-lead-design`'s under the visual carve-out.
