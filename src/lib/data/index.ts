// The data-access seam. Declared in .ai/standards/architecture.md; RULE-02 says nothing outside this
// directory may import the Supabase client, and eslint.config.js enforces it.
//
// This file carries the SHAPE only. The functions a feature needs are declared by the Tech Lead in
// design section 1 and added here — RULE-04 forbids inventing them ahead of a design.
//
// Two implementations exist and must stay in parity: `supabase.ts` and `mock.ts`. The seam-parity
// test in tests/ asserts identical exported names and equal arity, which is what makes swapping them
// a configuration change rather than a rewrite.
import type { AllowedEmail, Member, Result, Session } from "../domain/types";
import { seam as mockSeam } from "./mock";
import { seam as supabaseSeam } from "./supabase";

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  avatar: string;
}

/** TEA-02, 02-design.md section 1.2. */
export interface AddAllowedEmailInput {
  email: string;
}

export interface SignUpOutcome {
  /** True when the project has Confirm email on and the address is not yet confirmed. */
  needsEmailConfirmation: boolean;
  /** Non-null only when the project has Confirm email off. AC-13: the screen ignores it either way. */
  session: Session | null;
}

/** Every implementation of the seam satisfies this. It grows one entry per designed contract item. */
export interface DataSeam {
  /** Liveness probe. Present so the seam and its parity test are exercisable before any feature. */
  ready(): Promise<boolean>;

  /**
   * AC-1, AC-5, AC-8, AC-13. Creates the auth user and nothing else — the `member` row is the
   * trigger's work, never this function's. It returns the same shape whether or not the address is
   * allow-listed, and it cannot tell the difference; that is what makes AC-5 hold.
   */
  signUp(input: SignUpInput): Promise<Result<SignUpOutcome>>;

  /**
   * AC-1, AC-9. Null means "this auth user has no member row", which is a normal answer and not an
   * error. Under `member_select_own` (design section 4) a caller can only ever address their own
   * row, so `userId` is a readability parameter and not a permission surface.
   *
   * Nothing in this ticket's interface calls it — the sign-up screen ends on its own notice (AC-13).
   * Its caller here is tests/permission-model.test.ts, which is how AC-1 and AC-9 are observed
   * through the seam rather than only through raw SQL.
   */
  getOwnMember(userId: string): Promise<Member | null>;

  // -------------------------------------------------------------------------
  // TEA-02 - manage the allow-list. 02-design.md section 1.2.
  // -------------------------------------------------------------------------

  /**
   * AC-1, AC-9. The caller's own member row, or null when nobody is signed in or the auth user has
   * no member row. Null is a normal answer and not an error.
   *
   * The sign-in half of TEA-01 does not exist, so in a real build this returns null on every call -
   * see "Prerequisites this ticket does not own" in 02-design.md section 5.
   */
  getCurrentMember(): Promise<Member | null>;

  /**
   * AC-1. Every allow-list entry the caller may read, newest first. Takes no team parameter: the
   * policy scopes the rows to the caller's team, and a parameter would imply the caller could ask
   * for another team's and be answered.
   */
  listAllowedEmails(): Promise<AllowedEmail[]>;

  /**
   * AC-2, AC-4, AC-5. `teamId` is never a parameter - the policy's `with check` supplies it, so
   * there is no value a caller could pass that would move an entry to another team.
   */
  addAllowedEmail(input: AddAllowedEmailInput): Promise<Result<AllowedEmail>>;

  /** AC-6, AC-7, AC-8. Refused by the policy for a consumed entry and for a non-admin. */
  removeAllowedEmail(email: string): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // TEA-03 - the team member list. 02-design.md section 1.2.
  // -------------------------------------------------------------------------

  /**
   * TEA-03 AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8. The caller's team roster.
   *
   * Takes no team parameter: `member_select_team` scopes the rows to the caller's own team, and a
   * parameter would imply the caller could ask for another team's and be answered - the same
   * reasoning that kept `teamId` off `addAllowedEmail`.
   *
   * RETURNS REMOVED MEMBERS, carrying `removedAt`. Which rows the screen draws is a display
   * decision above the seam; which rows the read returns is not - ADR-013 and the INV-04 note
   * require the counting function to be GIVEN the roster with `removedAt` per member, because it
   * cannot derive membership-as-of-a-date from the entries. A filter here would make INV-04
   * uncomputable for every past date, and CAL-04 and CAL-06 unbuildable against this read.
   *
   * Ordered by `createdAt` ascending, then `id` ascending. Deterministic in both implementations -
   * `FIXTURE_ADMIN` and `FIXTURE_MEMBER` share a `createdAt` literal, so the id tiebreaker is what
   * stops the two implementations disagreeing about row order (02-design.md section 1.4).
   *
   * An empty array is a normal answer and not an error: it is what the policy returns to a caller
   * with no member row (AC-7) and to a caller with no session (AC-6).
   *
   * THROWS on a transport failure and on a possibly-truncated answer (AC-8). There is no
   * caller-visible failure shape, so a `Result` would have nothing to carry; returning `[]` for a
   * broken connection would report "you are on no team" for what is a network fault, and returning
   * a short list for a capped read is the exact failure AC-8 exists to prevent.
   */
  listMembers(): Promise<Member[]>;

  // -------------------------------------------------------------------------
  // TEA-04 - remove a member, and promote a member to admin. 01-plan.md section 4.2.
  // -------------------------------------------------------------------------

  /**
   * TEA-04 AC-1, AC-3, AC-6, AC-9, AC-11, AC-12. Soft-removes a member of the caller's own team.
   *
   * TAKES NO TIMESTAMP. `removed_at` is written by the datastore's own clock and a caller-supplied
   * value is discarded by the trigger (AC-3) - ADR-013's revert condition is a backdated removal
   * moving every past absence count silently and everywhere, so there is no parameter here that
   * could carry one.
   *
   * `memberId` is an ADDRESS and not a permission surface. It names an existing row that the policy
   * then filters by team and by the caller's role - the shape `removeAllowedEmail(email)` already
   * uses. It is unlike the `teamId` deliberately kept off `addAllowedEmail`, which would have
   * SUPPLIED a value that landed in the row.
   *
   * Returns the updated row. The `.select()` in the real implementation is not a convenience: under
   * row-level security a refused UPDATE is FILTERED, not errored - it matches nothing and PostgREST
   * answers 200 with an empty body (ADR-016 section 4, behaviour 2). Zero rows returned is a
   * refusal and is mapped to `not_permitted`; treating `!error` as success would report a refusal
   * as done.
   */
  removeMember(memberId: string): Promise<Result<Member>>;

  /**
   * TEA-04 AC-4, AC-5, AC-6, AC-10, AC-11, AC-12. Promotes a member of the caller's own team to
   * admin. ONE-WAY: there is no `demoteMember`, and adding one would be inventing a permission -
   * `Demote an admin to member` is not decided and is denied until it is.
   *
   * Returns the updated row, and treats zero rows as a refusal, for the same reason as above.
   */
  promoteMember(memberId: string): Promise<Result<Member>>;
}

export type { DataSeam as Seam };

// Which implementation a build resolves to. 02-design.md section 6.2.
//
// This file is the one door, and it makes the choice — nothing above the seam names an
// implementation. The first two revisions of the design were silent on this, so SignUp.tsx imported
// `./supabase` by hand and the end-to-end build constructed a real client against an absent
// VITE_SUPABASE_URL, which raises `supabaseUrl is required.` on submit. QA found it as five failing
// tests with no error on screen.
//
// Importing both implementations is safe: supabase.ts builds its client lazily, and that laziness
// already exists for this exact reason. The two `import type` lines back from mock.ts and
// supabase.ts are erased at build, so there is no runtime cycle.
const usesMock = import.meta.env.VITE_DATA_SEAM === "mock" || !import.meta.env.VITE_SUPABASE_URL;

/**
 * Read by `App.tsx` to render `seam-banner`. A silent fallback to a fake datastore is the failure
 * that rule exists to prevent: a deployment that forgets one environment variable would otherwise
 * accept sign-ups into memory and look entirely normal.
 */
export const seamName: "mock" | "supabase" = usesMock ? "mock" : "supabase";

export const seam: DataSeam = usesMock ? mockSeam : supabaseSeam;
