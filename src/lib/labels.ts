// OPS-002 — the label sets, declared once. 01-plan.md section 4.
//
// `.ai/standards/ui-design-system.md` § Language says every string the interface renders is
// English. This file is where the three sets that name an entry's type, portion and status now
// live, and AC-8 is the assertion that there is exactly one declaration of each.
//
// **THE DUPLICATION IS THE DEFECT AND THE LANGUAGE IS ONLY HOW IT BECAME VISIBLE.** Before this
// ticket the tree held five declarations of the type labels, three of the portion labels and two of
// the status labels, in two languages; `WeekView.tsx` said `All day` where `TeamEntries.tsx` and
// `PendingEntries.tsx` said `Full day`, a divergence nobody introduced deliberately and no test
// caught. AC-13 settles that to one wording. `TeamEntries.tsx:42` handed the fold to "the ticket
// that translates the other thirteen files" and `PendingEntries.tsx:71` handed it to OPS-001, which
// shipped without doing it; this is that fold.
//
// **ABOVE THE SEAM AND NOT IN `src/lib/data/`.** It imports domain types and nothing else, so
// RULE-02 and the `supabase-client-in-seam` boundary are untouched. It is deliberately NOT a keyed
// catalogue and needs no package: `Record<EntryType, string>` gives exhaustiveness on exactly the
// three sets where the duplication hurt, and the product has one language (01-plan.md section 8).
import type { EntryPortion, EntryStatus, EntryType } from "@/lib/domain/types";

// CAL-01 AC-4. WFH is a TYPE and not a second feature: one control, two values, and everything
// downstream of it is identical.
//
// A WFH member IS working — the glossary calls this the single most costly confusion in the domain,
// which is why the label says so rather than saying "vắng". That sentence is EntryForm.tsx's, moved
// here with the map it explains and deliberately not translated: `vắng` is a quoted term inside an
// explanation of why the label avoids it, and translating it would destroy the comment's meaning
// (01-plan.md section 1, Out of scope). OPS-002 AC-7 is the assertion that the English wording
// still states the member is working.
export const TYPE_LABELS: Record<EntryType, string> = {
  pto: "Leave",
  wfh: "Working from home",
};

/** INV-06: one portion for the whole entry, so one label for the whole range. There is deliberately
 *  no per-date control — a trip leaving Wednesday afternoon and returning Monday morning is up to
 *  three entries, and the form does not pretend otherwise. */
export const PORTION_LABELS: Record<EntryPortion, string> = {
  full: "Full day",
  am: "Morning",
  pm: "Afternoon",
};

export const STATUS_LABELS: Record<EntryStatus, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};
