// TSK-01 — a member's own tasks for one day. 01-plan.md §§ 2b, 4.6 and 4.7. ADR-057.
//
// **EVERYTHING ON THIS PAGE IS THE CALLER'S OWN, AND THE PAGE IS NOT WHAT MAKES IT SO.** The four
// policies on `public.task` are the control; the seam has no parameter that names a member, so this
// screen cannot even ask for anyone else's list. Every refusal drawn here — the hidden add form on a
// past day, the date field's minimum, the field messages — is an affordance.
//
// **"TODAY" IS `eventToday()`, Asia/Ho_Chi_Minh** (01-plan.md § 1 decision 1), read ONCE per render
// and handed to the overdue read, so the screen and the read agree on one instant.
//
// **NO TIME OF ANY KIND IS SHOWN** (AC-20): a task's date, and nothing finer.
//
// **THE TICK IS OPTIMISTIC** (TSK-05, its 01-plan.md § 4.2). A press shows at once and writes behind
// it through `src/lib/task-tick.ts`; it never disables the box, never reloads a list, and a refusal
// puts the row back. Edit, move, add and delete keep the write-then-reload flow below unchanged.
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { seam } from "@/lib/data";
import type { Failure, Result, Task } from "@/lib/domain/types";
import { eventToday } from "@/lib/event-registration";
import { createTaskTicker, type TaskTicker, type TickOutcome } from "@/lib/task-tick";
import Loader from "@/components/Loader";
import Modal from "@/components/Modal";
import { PILL_OUTLINE } from "@/components/TopBar";

// TopBar's `ICON_BUTTON`, repeated as NotificationBell repeats it: the same 32-pixel round arrows the
// period navigation uses (§ 2b).
const ICON_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-pill text-lg leading-none text-ink-2 " +
  "transition-colors hover:bg-field hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const PRIMARY =
  "rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 " +
  "disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const QUIET =
  "rounded-pill px-2 py-1 text-xs font-semibold text-ink-3 transition-colors hover:bg-field hover:text-ink " +
  "disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const FIELD =
  "w-full rounded-xl bg-field px-3 py-2 text-sm text-ink placeholder:text-ink-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const LOAD_FAILED = "Your tasks could not be loaded. Please try again.";

/** AC-3. A `yyyy-MM-dd` that names a real calendar day — `2026-02-30` does not. */
function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const shiftDay = (day: string, by: number): string => format(addDays(parseISO(day), by), "yyyy-MM-dd");

/** § 2b. *Thursday, 15 October 2026*. */
const headingLabel = (day: string): string => format(parseISO(day), "EEEE, d MMMM yyyy");

/** § 2b. The overdue row's chip, *Mon 12 Oct*. */
const chipLabel = (day: string): string => format(parseISO(day), "EEE d MMM");

type Field = "title" | "note" | "date";

/** Which field a refusal belongs beside (AC-8, AC-11); null is a message for the row as a whole. */
function fieldOf(failure: Failure): Field | null {
  switch (failure.code) {
    case "invalid_task_title":
      return "title";
    case "invalid_task_note":
      return "note";
    case "task_date_past":
      return "date";
    default:
      return null;
  }
}

interface Errors {
  title?: string;
  note?: string;
  date?: string;
  general?: string;
}

const errorsOf = (failure: Failure): Errors => {
  const field = fieldOf(failure);
  return field ? { [field]: failure.message } : { general: failure.message };
};

function FieldError({ field, message }: { field: Field; message: string | undefined }): JSX.Element | null {
  if (!message) return null;
  return (
    <p data-testid="task-field-error" data-field={field} role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

function GeneralError({ message }: { message: string | undefined }): JSX.Element | null {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// One row — view, edit and move. AC-9 to AC-12, in both lists.
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: Task;
  today: string;
  /** AC-13. The overdue section shows each task's date; the day's list does not need to. */
  showDate: boolean;
  onChanged(): Promise<void>;
  onDelete(task: Task): void;
  /** TSK-05 AC-1. The page's ticker flips the shown value and writes behind it. */
  onTick(): void;
  /** TSK-05 AC-3. The last tick's refusal, shown in the row's general message. */
  tickError: string | undefined;
}

function TaskRow({ task, today, showDate, onChanged, onDelete, onTick, tickError }: TaskRowProps): JSX.Element {
  const [mode, setMode] = useState<"view" | "edit" | "move">("view");
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? "");
  const [date, setDate] = useState(task.date);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const run = async (write: () => Promise<Result<Task>>): Promise<void> => {
    setBusy(true);
    const result = await write();
    setBusy(false);
    if (!result.ok) {
      setErrors(errorsOf(result.error));
      return;
    }
    setErrors({});
    setMode("view");
    await onChanged();
  };

  const startEdit = (): void => {
    setTitle(task.title);
    setNote(task.note ?? "");
    setErrors({});
    setMode("edit");
  };

  // AC-11. The field opens on the task's own date, or on today when that date is already past.
  const startMove = (): void => {
    setDate(task.date < today ? today : task.date);
    setErrors({});
    setMode("move");
  };

  const cancel = (): void => {
    setErrors({});
    setMode("view");
  };

  return (
    <li
      data-testid="task-row"
      data-task-id={task.id}
      data-date={task.date}
      data-done={task.done ? "true" : "false"}
      className="group flex flex-col gap-2 border-b border-line py-2.5 last:border-b-0"
    >
      {mode === "edit" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => seam.updateTask(task.id, { title, note }));
          }}
        >
          <input
            data-testid="task-edit-title"
            aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={FIELD}
          />
          <FieldError field="title" message={errors.title} />
          <textarea
            data-testid="task-edit-note"
            aria-label="Note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className={FIELD}
          />
          <FieldError field="note" message={errors.note} />
          <GeneralError message={errors.general} />
          <div className="flex gap-2">
            <button data-testid="task-edit-save" type="submit" disabled={busy} className={PRIMARY}>
              Save
            </button>
            <button data-testid="task-edit-cancel" type="button" onClick={cancel} className={PILL_OUTLINE}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-3">
          {/* AC-9. A round box, mint when ticked. A button with the checkbox role, so it carries
              `aria-checked` and is reached by the keyboard. TSK-05 AC-1: never disabled, so a second
              press acts at once. */}
          <button
            data-testid="task-done"
            type="button"
            role="checkbox"
            aria-checked={task.done}
            aria-label={task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
            onClick={onTick}
            className={
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2 transition-colors " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
              (task.done ? "border-wfh bg-wfh text-wfh-ink" : "border-line bg-card hover:border-ink-3")
            }
          >
            {task.done ? (
              <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            ) : null}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {showDate ? (
                <span
                  data-testid="task-date-chip"
                  className="inline-flex shrink-0 items-center rounded-pill bg-field px-2 py-0.5 text-[11px] font-bold text-ink-2"
                >
                  {chipLabel(task.date)}
                </span>
              ) : null}
              <span
                data-testid="task-title"
                className={`break-words text-sm font-bold ${task.done ? "text-ink-3 line-through" : "text-ink"}`}
              >
                {task.title}
              </span>
            </div>
            {task.note ? (
              <p data-testid="task-note" className="mt-0.5 line-clamp-2 whitespace-pre-line break-words text-xs text-ink-3">
                {task.note}
              </p>
            ) : null}
          </div>

          {/* § 2b. Visible on hover from `md`, always visible at phone width. */}
          <div className="flex shrink-0 gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <button data-testid="task-edit" type="button" onClick={startEdit} className={QUIET}>
              Edit
            </button>
            <button data-testid="task-move" type="button" onClick={startMove} className={QUIET}>
              Move
            </button>
            <button data-testid="task-delete" type="button" onClick={() => onDelete(task)} className={QUIET}>
              Delete
            </button>
          </div>
        </div>
      )}

      {mode === "move" ? (
        <form
          className="flex flex-col gap-2 pl-8"
          // The browser's own `min` check would swallow the submit with no sentence; the seam's
          // `task_date_past` is what AC-11 shows beside the field.
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => seam.moveTask(task.id, date));
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {/* AC-11. `min` is an affordance; the seam refuses `task_date_past` either way. */}
            <input
              data-testid="task-move-date"
              type="date"
              aria-label="Move to"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${FIELD} w-auto`}
            />
            <button data-testid="task-move-save" type="submit" disabled={busy} className={PRIMARY}>
              Move
            </button>
            <button data-testid="task-move-cancel" type="button" onClick={cancel} className={PILL_OUTLINE}>
              Cancel
            </button>
          </div>
          <FieldError field="date" message={errors.date} />
        </form>
      ) : null}

      {mode !== "edit" ? <GeneralError message={errors.general ?? tickError} /> : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// The add form. AC-6 to AC-8; present on today and later days only.
// ---------------------------------------------------------------------------

function AddTaskForm({ day, onAdded }: { day: string; onAdded(): Promise<void> }): JSX.Element {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  return (
    <form
      data-testid="task-add-form"
      className="flex flex-col gap-2 border-t border-line pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          setBusy(true);
          const result = await seam.createTask({ date: day, title, note });
          setBusy(false);
          if (!result.ok) {
            setErrors(errorsOf(result.error));
            return;
          }
          setErrors({});
          setTitle("");
          setNote("");
          await onAdded();
        })();
      }}
    >
      <input
        data-testid="task-add-title"
        aria-label="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task"
        className={FIELD}
      />
      <FieldError field="title" message={errors.title} />
      <textarea
        data-testid="task-add-note"
        aria-label="Task note"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className={FIELD}
      />
      <FieldError field="note" message={errors.note} />
      {/* A create refused `task_date_past` only when the day turned over while the page was open. */}
      <FieldError field="date" message={errors.date} />
      <GeneralError message={errors.general} />
      <div>
        <button data-testid="task-add-submit" type="submit" disabled={busy} className={PRIMARY}>
          Add
        </button>
      </div>
    </form>
  );
}

/** `record` without `key`; the same object when the key is absent, so React skips the render. */
function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

// ---------------------------------------------------------------------------
// The page.
// ---------------------------------------------------------------------------

type LoadState =
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "ready"; day: string; tasks: Task[]; overdue: Task[] };

export default function Tasks(): JSX.Element {
  const { day: param } = useParams();
  const navigate = useNavigate();
  const today = eventToday();
  const valid = param === undefined || isCalendarDay(param);
  const day = param !== undefined && valid ? param : today;
  const isToday = day === today;

  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [confirming, setConfirming] = useState<Task | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** TSK-05 AC-3. Each task's last tick refusal, by task id. */
  const [tickErrors, setTickErrors] = useState<Record<string, string>>({});
  const [, setRenders] = useState(0);

  // TSK-05 § 4.2. One ticker for the page's lifetime; every callback it holds is a stable setter.
  const tickerRef = useRef<TaskTicker | null>(null);
  if (tickerRef.current === null) {
    tickerRef.current = createTaskTicker(
      (id, done) => seam.setTaskDone(id, done),
      () => setRenders((n) => n + 1),
      (outcome: TickOutcome) => {
        if (outcome.kind === "saved") {
          const saved = outcome.task;
          const swap = (list: Task[]): Task[] => list.map((t) => (t.id === saved.id ? saved : t));
          setState((s) => (s.phase === "ready" ? { ...s, tasks: swap(s.tasks), overdue: swap(s.overdue) } : s));
          setTickErrors((e) => withoutKey(e, saved.id));
        } else if (outcome.kind === "failed") {
          setTickErrors((e) => ({ ...e, [outcome.taskId]: outcome.failure.message }));
        }
      },
    );
  }
  const ticker = tickerRef.current;

  const load = useCallback(async (): Promise<void> => {
    // TSK-05 AC-6. A tick that ends while this load is out wins over what the load read.
    const mark = ticker.mark();
    try {
      const [tasks, overdue] = await Promise.all([
        seam.listTasks(day, day),
        isToday ? seam.listOverdueTasks(today) : Promise.resolve([]),
      ]);
      setState({
        phase: "ready",
        day,
        tasks: tasks.map((t) => ticker.reconcile(t, mark)),
        overdue: overdue.map((t) => ticker.reconcile(t, mark)),
      });
    } catch {
      setState({ phase: "failed" });
    }
  }, [day, isToday, today, ticker]);

  useEffect(() => {
    if (valid) void load();
  }, [load, valid]);

  // AC-3. Anything that is not a calendar day lands on today.
  if (!valid) return <Navigate to="/tasks" replace />;

  const goTo = (target: string): void => {
    navigate(`/tasks/${target}`);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!confirming) return;
    setDeleting(true);
    const result = await seam.deleteTask(confirming.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error.message);
      return;
    }
    setConfirming(null);
    setDeleteError(null);
    await load();
  };

  const closeConfirm = (): void => {
    setConfirming(null);
    setDeleteError(null);
  };

  /** TSK-05 AC-1, AC-3. `task` is the row as the server last gave it, not as shown. */
  const tick = (task: Task): void => {
    setTickErrors((e) => withoutKey(e, task.id));
    ticker.tap(task);
  };

  // TSK-05. The key leaves out `done`, so a press does not remount the row and the box keeps focus.
  const rowKey = (task: Task): string => `${task.id}:${task.date}:${task.title}:${task.note ?? ""}`;

  // A stale list from the previous day is not shown under the new day's heading.
  const ready = state.phase === "ready" && state.day === day ? state : null;

  return (
    <section
      data-testid="tasks-page"
      className="mx-auto flex w-full max-w-[640px] flex-col gap-5 rounded-card bg-card p-4 shadow-soft sm:p-6"
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-ink">My tasks</h1>
          <p data-testid="tasks-day-heading" data-day={day} className="mt-0.5 text-sm font-semibold text-ink-2">
            {headingLabel(day)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            data-testid="tasks-prev-day"
            type="button"
            aria-label="Previous day"
            onClick={() => goTo(shiftDay(day, -1))}
            className={ICON_BUTTON}
          >
            ‹
          </button>
          {isToday ? null : (
            <Link data-testid="tasks-today" to="/tasks" className={PILL_OUTLINE}>
              Today
            </Link>
          )}
          <button
            data-testid="tasks-next-day"
            type="button"
            aria-label="Next day"
            onClick={() => goTo(shiftDay(day, 1))}
            className={ICON_BUTTON}
          >
            ›
          </button>
        </div>
      </header>

      {state.phase === "failed" ? (
        <p role="alert" className="text-center text-sm text-danger">
          {LOAD_FAILED}
        </p>
      ) : ready === null ? (
        <p role="status" className="text-center text-sm text-ink-2">
          <Loader label="Loading tasks…" />
        </p>
      ) : (
        <>
          {/* AC-13 to AC-15. Today only, and only while something is overdue. */}
          {isToday && ready.overdue.length > 0 ? (
            <div data-testid="tasks-overdue" className="rounded-card bg-overload px-4 py-3">
              <h2 className="text-sm font-extrabold text-ink">
                {/* TSK-05 AC-7. The rows shown not done; a ticked row stays until the next load. */}
                Overdue ·{" "}
                <span data-testid="tasks-overdue-count">
                  {ready.overdue.filter((t) => !ticker.shown(t).done).length}
                </span>
              </h2>
              <ul className="mt-1">
                {ready.overdue.map((task) => (
                  <TaskRow
                    key={rowKey(task)}
                    task={ticker.shown(task)}
                    today={today}
                    showDate
                    onChanged={load}
                    onDelete={setConfirming}
                    onTick={() => tick(task)}
                    tickError={tickErrors[task.id]}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {ready.tasks.length > 0 ? (
            <ul data-testid="tasks-list">
              {ready.tasks.map((task) => (
                <TaskRow
                  key={rowKey(task)}
                  task={ticker.shown(task)}
                  today={today}
                  showDate={false}
                  onChanged={load}
                  onDelete={setConfirming}
                  onTick={() => tick(task)}
                  tickError={tickErrors[task.id]}
                />
              ))}
            </ul>
          ) : (
            <p data-testid="tasks-empty" className="py-6 text-center text-sm text-ink-2">
              {day >= today ? "Nothing planned yet. Add the first task below." : "Nothing was planned for this day."}
            </p>
          )}

          {/* AC-7. The form is ABSENT on an earlier day; the seam refuses `task_date_past` anyway. */}
          {day >= today ? (
            <AddTaskForm key={day} day={day} onAdded={load} />
          ) : (
            <p data-testid="tasks-past-day-note" className="border-t border-line pt-4 text-xs text-ink-3">
              Past days take no new tasks.
            </p>
          )}
        </>
      )}

      {confirming ? (
        <Modal testIdPrefix="task-delete-confirm" label="Delete this task?" onClose={closeConfirm}>
          <div data-testid="task-delete-confirm" className="flex flex-col gap-4">
            <h1 className="text-lg font-extrabold text-ink">Delete this task?</h1>
            <p className="break-words text-sm text-ink-2">{confirming.title}</p>
            {deleteError ? (
              <p role="alert" className="text-sm text-danger">
                {deleteError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                data-testid="task-delete-confirm-yes"
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className={PRIMARY}
              >
                Delete
              </button>
              <button data-testid="task-delete-confirm-no" type="button" onClick={closeConfirm} className={PILL_OUTLINE}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
