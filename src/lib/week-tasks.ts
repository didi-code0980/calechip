// TSK-04 — the viewer's own done/total per day of a week. 01-plan.md § 4.1.
//
// Pure: no React, no seam, no clock. **IT IS NOT AN ABSENCE COUNT AND NOTHING HERE FEEDS
// `absenceCountsFor`** — a task is not an entry, and this module imports nothing from absence,
// day-status or busy, so INV-04's one definition is not reached from here (§ 2, AC-11).
import type { DateRange, Task } from "@/lib/domain/types";

/** One day's tally. `total >= 1` always — a day with no task has no entry. */
export interface DayTaskTally {
  done: number;
  total: number;
}

/** AC-1..AC-4. For each date in `range` (inclusive) that holds at least one task in `tasks`, its
 *  tally. Tasks outside `range` are ignored. Days without tasks are absent from the map. Pure; does
 *  not mutate its input. Does not filter by owner — `listTasks` returns only the caller's rows. */
export function taskTalliesFor(
  tasks: readonly Task[],
  range: DateRange,
): ReadonlyMap<string, DayTaskTally> {
  const tallies = new Map<string, DayTaskTally>();
  for (const t of tasks) {
    // `yyyy-MM-dd` compares correctly as a string, the comparison every pure module here uses.
    if (t.date < range.start || t.date > range.end) continue;
    const tally = tallies.get(t.date) ?? { done: 0, total: 0 };
    tallies.set(t.date, { done: tally.done + (t.done ? 1 : 0), total: tally.total + 1 });
  }
  return tallies;
}

/** AC-1. The badge's visible text: `${done}/${total}`. */
export function tallyText(tally: DayTaskTally): string {
  return `${tally.done}/${tally.total}`;
}

/** AC-1. The badge's accessible name: `${done} of ${total} tasks done`; "task" when total === 1. */
export function tallyLabel(tally: DayTaskTally): string {
  return `${tally.done} of ${tally.total} ${tally.total === 1 ? "task" : "tasks"} done`;
}
