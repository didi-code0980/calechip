// EVT-01 — create and edit an event. One form for `/events/new` and `/events/:id/edit`.
// 01-plan.md § 2 AC-1 to AC-4, AC-10, AC-11, AC-14, AC-16, AC-23; § 2b; § 4.4.
//
// **NO FIELD HERE CAN NAME A CREATOR OR A TEAM** (AC-4, Q6). `SaveEventInput` has neither, and an
// own-team event is always the creator's team — the database sets it and withholds the column.
//
// **NO TIME OF DAY ANYWHERE** (AC-3, Q11): two date inputs and nothing finer.
//
// **EVERY REFUSAL THIS FORM SHOWS IS THE SEAM'S SENTENCE**, in the one `event-form-error` line. The
// empty-name and reversed-date refusals are made by the seam before any request leaves (AC-2, AC-3);
// both are affordances, and `event_name_present` / `event_dates_ordered` are the controls. The one
// check made here is that both dates were picked at all, because an unpicked date input is an empty
// string and not a date either implementation could compare.
//
// **THE PICKER IS INLINE, NOT A DIALOG** (§ 2b): a scrollable checklist grouped under team names,
// with a text filter, drawn only while `Named people` is chosen. It omits the caller — an
// affordance; `list_member_directory()` returns them and the policy would accept them.
import { useCallback, useEffect, useMemo, useState, type FormEvent, type JSX } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { seam } from "@/lib/data";
import type { DirectoryMember, EventScope, Member } from "@/lib/domain/types";
import Avatar from "@/components/Avatar";
import Loader from "@/components/Loader";
import { mayEditEvent } from "./EventDetail";

interface FormValues {
  name: string;
  startDate: string;
  endDate: string;
  scope: EventScope;
  inviteeIds: string[];
  location: string;
  description: string;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; me: Member | null; directory: DirectoryMember[]; initial: FormValues };

const SCOPE_CHOICES: readonly { scope: EventScope; label: string; hint: string }[] = [
  { scope: "team", label: "Own team", hint: "Everyone on your team" },
  { scope: "named", label: "Named people", hint: "Only the people you pick, from any team" },
  { scope: "public", label: "Every team", hint: "Everyone on every team" },
];

const FIELD =
  "w-full rounded-xl bg-field px-3 py-2 text-sm text-ink placeholder:text-ink-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const LABEL = "text-xs font-bold text-ink-3";

const fold = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function EventEditor(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const editing = id !== undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const load = useCallback(async (): Promise<void> => {
    try {
      const [me, directory] = await Promise.all([seam.getCurrentMember(), seam.listMemberDirectory()]);

      if (!editing) {
        const today = format(new Date(), "yyyy-MM-dd");
        setState({
          phase: "ready",
          me,
          directory,
          initial: {
            name: "",
            startDate: today,
            endDate: today,
            scope: "team",
            inviteeIds: [],
            location: "",
            description: "",
          },
        });
        return;
      }

      const event = id ? await seam.getEvent(id) : null;
      // § 4.4: an id the caller may not edit renders `event-not-found`, the same as one that does
      // not exist. The affordance; `event_update_manage` refuses the write regardless.
      if (!event || !mayEditEvent(event, me)) {
        setState({ phase: "missing" });
        return;
      }
      const inviteeIds = await seam.listEventInvitees(event.id);
      setState({
        phase: "ready",
        me,
        directory,
        initial: {
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          scope: event.scope,
          inviteeIds,
          location: event.location ?? "",
          description: event.description ?? "",
        },
      });
    } catch {
      setState({ phase: "missing" });
    }
  }, [editing, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // AC-23: cancel returns to where they came from. `location.key` is "default" only on a first
  // load with no in-app history behind it, and then the list is where they would have come from.
  const goBack = (): void => {
    if (location.key !== "default") navigate(-1);
    else navigate(editing && id ? `/events/${id}` : "/events");
  };

  if (state.phase === "loading") {
    return (
      <p role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-ink-2">
        <Loader label="Loading…" />
      </p>
    );
  }

  if (state.phase === "missing") {
    return (
      <section
        data-testid="event-not-found"
        className="mx-auto flex max-w-xl flex-col gap-4 rounded-card bg-card p-8 text-center text-sm text-ink-2 shadow-soft"
      >
        <p>We could not find that event.</p>
        <p>
          <Link to="/events" className="font-semibold text-ink underline">
            Back to events
          </Link>
        </p>
      </section>
    );
  }

  return (
    <EventForm
      editing={editing}
      eventId={id ?? null}
      me={state.me}
      directory={state.directory}
      initial={state.initial}
      onCancel={goBack}
      onSaved={(savedId) => navigate(`/events/${savedId}`)}
    />
  );
}

interface EventFormProps {
  editing: boolean;
  eventId: string | null;
  me: Member | null;
  directory: DirectoryMember[];
  initial: FormValues;
  onCancel(): void;
  onSaved(eventId: string): void;
}

function EventForm({
  editing,
  eventId,
  me,
  directory,
  initial,
  onCancel,
  onSaved,
}: EventFormProps): JSX.Element {
  const [values, setValues] = useState<FormValues>(initial);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]): void =>
    setValues((v) => ({ ...v, [key]: value }));

  // AC-10. Every approved member of every team except the caller, grouped under their team's name.
  const groups = useMemo(() => {
    const needle = fold(filter.trim());
    const byTeam = new Map<string, { teamName: string; people: DirectoryMember[] }>();
    for (const person of directory) {
      if (me !== null && person.id === me.id) continue;
      if (needle !== "" && !fold(`${person.displayName} ${person.teamName}`).includes(needle)) continue;
      const group = byTeam.get(person.teamId) ?? { teamName: person.teamName, people: [] };
      group.people.push(person);
      byTeam.set(person.teamId, group);
    }
    return [...byTeam.entries()].map(([teamId, group]) => ({ teamId, ...group }));
  }, [directory, filter, me]);

  const toggleInvitee = (memberId: string, on: boolean): void =>
    set(
      "inviteeIds",
      on
        ? [...values.inviteeIds.filter((x) => x !== memberId), memberId]
        : values.inviteeIds.filter((x) => x !== memberId),
    );

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);

    if (values.startDate === "" || values.endDate === "") {
      setError("Please choose a start date and an end date.");
      return;
    }

    setSaving(true);
    const input = {
      name: values.name,
      description: values.description,
      location: values.location,
      startDate: values.startDate,
      endDate: values.endDate,
      scope: values.scope,
      inviteeIds: values.scope === "named" ? values.inviteeIds : [],
    };
    const result =
      editing && eventId !== null
        ? await seam.updateEvent(eventId, input)
        : await seam.createEvent(input);
    setSaving(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    // AC-1, AC-23. The creator lands on the detail page.
    onSaved(result.value.id);
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4">
      {/* AC-23. Top to bottom: name; start and end side by side; scope as three choices; the picker
          only while Named people is chosen; location; description; save and cancel. */}
      <form
        data-testid="event-form"
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-5 rounded-card bg-card p-6 shadow-soft md:p-8"
      >
        <h1 className="text-xl font-extrabold text-ink">{editing ? "Edit event" : "New event"}</h1>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Name</span>
          <input
            data-testid="event-name-input"
            type="text"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Team lunch"
            className={FIELD}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Start date</span>
            <input
              data-testid="event-start-input"
              type="date"
              value={values.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>End date</span>
            <input
              data-testid="event-end-input"
              type="date"
              value={values.endDate}
              onChange={(e) => set("endDate", e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={`${LABEL} mb-1.5`}>Who is it for?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {SCOPE_CHOICES.map((choice) => {
              const on = values.scope === choice.scope;
              return (
                <label
                  key={choice.scope}
                  className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2 transition-colors ${
                    on ? "border-ink bg-field" : "border-line hover:border-ink-3"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-ink">
                    <input
                      data-testid={`event-scope-${choice.scope}`}
                      type="radio"
                      name="event-scope"
                      value={choice.scope}
                      checked={on}
                      onChange={() => set("scope", choice.scope)}
                      className="accent-ink"
                    />
                    {choice.label}
                  </span>
                  <span className="text-[11px] text-ink-3">{choice.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {values.scope === "named" ? (
          <div data-testid="event-picker" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className={LABEL}>People</span>
              <span className="text-xs text-ink-3">{values.inviteeIds.length} chosen</span>
            </div>
            <input
              data-testid="event-picker-filter"
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or team"
              className={FIELD}
            />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-line p-2">
              {groups.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-ink-3">Nobody matches.</p>
              ) : (
                groups.map((group) => (
                  <div key={group.teamId} data-testid="event-picker-group" data-team-id={group.teamId} className="mb-2 last:mb-0">
                    <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-3">
                      {group.teamName}
                    </p>
                    <ul>
                      {group.people.map((person) => {
                        const on = values.inviteeIds.includes(person.id);
                        return (
                          <li key={person.id}>
                            <label
                              data-testid="event-picker-option"
                              data-member-id={person.id}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-ink hover:bg-field"
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={(e) => toggleInvitee(person.id, e.target.checked)}
                                className="accent-ink"
                              />
                              <Avatar value={person.avatar} className="h-6 w-6 rounded-full" />
                              {person.displayName}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Location (optional)</span>
          <input
            data-testid="event-location-input"
            type="text"
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Description (optional)</span>
          <textarea
            data-testid="event-description-input"
            rows={4}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            className={FIELD}
          />
        </label>

        {error !== null ? (
          <p data-testid="event-form-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            data-testid="event-cancel"
            type="button"
            onClick={onCancel}
            className="rounded-pill border border-line px-4 py-2 text-xs font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cancel
          </button>
          <button
            data-testid="event-save"
            type="submit"
            disabled={saving}
            className="rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Create event"}
          </button>
        </div>
      </form>
    </section>
  );
}
