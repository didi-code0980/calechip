-- CaleChip — the whole schema, in one file. Applied by a human (RULE-09), never by an agent.
--
-- ============================================================================================
-- WHAT THIS FILE IS, AND WHAT IT IS NOT
-- ============================================================================================
--
-- Written under ADR-026, which supersedes ADR-025. It carries the TARGET schema: everything the
-- seven shipped migrations create, PLUS four groups of objects that two accepted ADRs write out in
-- full but whose migrations have not been written yet.
--
-- EVERY STATEMENT BELOW IS MARKED WITH ITS PROVENANCE, and the distinction is the point:
--
--   [SHIPPED]  transcribed from a file in supabase/migrations/. Merged, reviewed, gated.
--   [OWED]     transcribed from an accepted ADR clause. NOT YET IN ANY MIGRATION and not yet
--              through a PLAN gate. The comment names the ADR clause and the ticket that owes it.
--
-- supabase/migrations/ IS STILL THE MECHANISM (.ai/standards/data-model.md, section Migrations).
-- THIS FILE IS NOT A MIGRATION. Applying it does NOT discharge the migration that ADM-02, ADM-03,
-- ADM-05 or ADM-06 still owes — each of those tickets writes its own file under
-- supabase/migrations/ when it is planned, and that file is what a fresh environment and the CLI's
-- own history read. ADR-026 decision point 6, and its first revert condition.
--
-- ORDER IS BY OBJECT CLASS, NOT BY MIGRATION. A single-pass script has to satisfy the foreign keys
-- and the enum references in one go, which the migration order does not do on its own. SYNTAX IS
-- ADAPTED FOR IDEMPOTENCE AND FOR THAT ORDERING. No predicate, column, type, name, value or
-- comment-of-record is changed. Where a shipped migration explains WHY a statement is shaped as it
-- is, that reasoning is kept — a schema stripped of its reasons is how the next person reverses one.
--
-- IDEMPOTENT, AND HERE IS THE LIMIT OF THAT WORD. Re-running against a database this file already
-- built is a no-op. Re-running against a database whose objects DIFFER is ALSO a no-op: `create
-- table if not exists` and the guarded `create type` blocks accept a divergent existing object
-- SILENTLY and report success. THIS FILE IS NOT A REPAIR TOOL and it cannot migrate anything.
-- It is for standing a fresh Supabase project up. ADR-026, Consequences.
--
-- ONE TRANSACTION. If any statement fails, nothing is applied. This is deliberately unlike
-- supabase/seed.sql, which has no begin/commit and can leave a partial state — ADR-024 decision
-- point 4 records that as a real hazard.
--
-- THREE THINGS ARE MISSING ON PURPOSE, AND THEIR ABSENCE CHANGES BEHAVIOUR. Read the block at the
-- end of this file, `SECTION 9`, BEFORE you conclude the product works after applying this.
--
-- Field names and types come from .ai/standards/data-model.md without alteration (RULE-04).
--
-- ============================================================================================

begin;


-- ============================================================================================
-- SECTION 0 — Extensions
-- ============================================================================================

-- [SHIPPED] TEA-01. citext, for the case-insensitive allow-list key.
-- TODO(verify): availability on the hosted project was never confirmed. If it is unavailable the
-- named fallback is `email text primary key` with `check (email = lower(email))`, the trigger
-- comparing `a.email = lower(new.email)`, and `set search_path = ''` on the trigger function.
create extension if not exists citext with schema extensions;

-- [SHIPPED] CAL-01. `member_id with =` puts a uuid equality test inside a GiST index, and core
-- GiST has no operator class for it (ADR-011 section 4).
-- TODO(verify): availability, and whether `extensions` is on the search_path in force when the
-- exclusion constraint is created. If the operator class does not resolve, SECTION 3 fails with
-- "data type uuid has no default operator class for access method gist". The fix is to
-- schema-qualify or extend the search_path — NEVER to drop `member_id` from the constraint, which
-- would make INV-01 global across the team.
create extension if not exists btree_gist with schema extensions;


-- ============================================================================================
-- SECTION 1 — Enumerated types
--
-- `create type` has no `if not exists` in any PostgreSQL major, so each is guarded. The guard
-- swallows duplicate_object only: a type that exists with DIFFERENT values is accepted silently,
-- which is the divergence caveat in this file's preamble.
-- ============================================================================================

-- [SHIPPED] TEA-01. Rank order and the full permission table are in
-- .ai/standards/rbac-and-security.md.
do $$ begin
  create type public.member_role as enum ('member', 'admin');
exception when duplicate_object then null;
end $$;

-- [SHIPPED] CAL-01. Values are data-model.md's, in its order. A WFH member is working — the
-- glossary calls this the most costly confusion in the domain.
do $$ begin
  create type public.entry_type as enum ('pto', 'wfh');
exception when duplicate_object then null;
end $$;

-- [SHIPPED] CAL-01. INV-06: one portion for the whole range. A five-day `pm` entry is five
-- afternoons.
do $$ begin
  create type public.entry_portion as enum ('full', 'am', 'pm');
exception when duplicate_object then null;
end $$;

-- [SHIPPED] CAL-01.
do $$ begin
  create type public.entry_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

-- [OWED] ADM-02 — transcribed from ADR-015 section 3. No migration exists for this yet.
--
-- Exactly two values, and THEY NAME THE EFFECT ON THE WORKING CALENDAR, NOT THE VIETNAMESE LABEL.
-- `name` already carries the label, and three labels (`nghi le`, `nghi bu`, `lam bu`) collapse to
-- two effects; a three-value enum would invite a third code path that can never differ from one of
-- the other two. A `lam bu` mandated Saturday is `working`: a weekend day that counts as a working
-- day, the exact inverse of a holiday.
do $$ begin
  create type public.holiday_kind as enum ('non_working', 'working');
exception when duplicate_object then null;
end $$;


-- ============================================================================================
-- SECTION 2 — Tables
--
-- Ordered by foreign key: team, then member, then allowed_email and entry, then holiday, which
-- references nothing. NO CASCADE ANYWHERE, and that is a decision rather than an omission
-- (data-model.md): every relationship refuses on delete. A cascade nobody chose is one the database
-- performs silently, and the invariant it breaks is found by its absence.
-- ============================================================================================

-- [SHIPPED] TEA-01. One row in v1. The table exists anyway because INV-07 counts entries against a
-- team, and the brief's P2 list asks the model to leave room for more.
-- `overload_threshold` is a SHARE, not a count (glossary.md, Threshold).
create table if not exists public.team (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  overload_threshold numeric not null default 0.5,
  created_at         timestamptz not null default now()
);

-- [SHIPPED] TEA-01. THE MEMBER'S ID IS THE SUPABASE AUTH USER ID. Every policy is then
-- `... = auth.uid()` with no lookup, which matters more than it looks: under ADR-005 a policy
-- written loosely fails open, and the shortest correct policy is the one hardest to write wrongly.
--
-- `removed_at` is a soft delete, and it is what "current member count" MEANS — INV-04's denominator
-- is the team's members with `removed_at is null`.
create table if not exists public.member (
  id           uuid primary key references auth.users (id) on delete restrict,
  team_id      uuid not null references public.team (id) on delete restrict,
  display_name text not null,
  avatar       text not null,
  role         public.member_role not null default 'member',
  removed_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- [SHIPPED] TEA-01. The gate on membership (ADR-009). An admin adds an address; the person signs
-- themselves up; the trigger in SECTION 5 creates the `member` row only if the address is here, and
-- marks the entry consumed. THERE IS NO INVITATION EMAIL.
create table if not exists public.allowed_email (
  email       extensions.citext primary key,
  team_id     uuid not null references public.team (id) on delete restrict,
  added_by    uuid not null references public.member (id) on delete restrict,
  added_at    timestamptz not null default now(),
  consumed_at timestamptz
);

-- [SHIPPED] CAL-01. The unit everything else counts, approves and displays.
--
-- Both references are `on delete restrict`. A member is soft-deleted and never removed, so it should
-- never fire — and if it does it is protecting INV-07 and the refusal is the correct outcome.
-- Nulling `approved_by` would erase who approved.
create table if not exists public.entry (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references public.member (id) on delete restrict,
  type             public.entry_type not null,
  portion          public.entry_portion not null default 'full',
  start_date       date not null,
  end_date         date not null,          -- INCLUSIVE. Equal to start_date for a single day.
  tentative        boolean not null default false,
  status           public.entry_status not null default 'pending',
  rejection_reason text,
  note             text,
  approved_by      uuid references public.member (id) on delete restrict,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- The '[]' constructor is REQUIRED by the inclusive end_date. `daterange(start_date, end_date)`
  -- defaults to '[)' and would silently drop the last day of every entry (ADR-011 section 1).
  --
  -- PostgreSQL canonicalises a stored discrete range to '[)', so a one-day entry is stored and read
  -- back as ['2026-01-01','2026-01-02') and the upper bound is the day AFTER the entry ends. The
  -- seam reads `end_date`, the plain column, and never derives the end from this.
  date_range       daterange generated always as (daterange(start_date, end_date, '[]')) stored,

  -- Slot 0 is the morning, slot 1 the afternoon (ADR-011 section 3). This exists so INV-01's
  -- constraint can INTERSECT portions rather than compare them for equality.
  portion_slots    int4range generated always as (
                     case portion
                       when 'full' then int4range(0, 2)
                       when 'am'   then int4range(0, 1)
                       when 'pm'   then int4range(1, 2)
                     end
                   ) stored,

  -- AC-9's second lock. The seam refuses an inverted range before the request is sent, because an
  -- inverted pair otherwise fails inside `date_range` above with "range lower bound must be less
  -- than or equal to range upper bound" — a database error text where a sentence about dates
  -- belongs. This constraint means a caller bypassing the application still cannot store one.
  constraint entry_end_after_start check (end_date >= start_date),

  -- INV-03, and it is a BICONDITIONAL. One-directional would let an approved entry keep a stale
  -- reason, and the invariant would read as claimed and not be held — which
  -- .ai/registry/invariants.md calls worse than never claiming it. ADR-016 section 3 requires both
  -- directions and DEPENDS on this shape: clause (b) of the trigger nulls the reason on approval
  -- precisely because this check refuses the transition otherwise.
  constraint entry_rejection_reason_iff_rejected check (
    (status = 'rejected'::public.entry_status)
      = (rejection_reason is not null and btrim(rejection_reason) <> '')
  )
);

-- [OWED] ADM-02 — transcribed from ADR-015 section 3. No migration exists for this yet.
--
-- SYSTEM-WIDE, NOT PER TEAM. There is no team_id and no foreign key: Vietnamese public holidays and
-- the announced swap days are national, glossary.md says "Holidays belong to the calendar, not to
-- any member", and INV-07 constrains entries and the members they belong to rather than a row that
-- has neither. `product` recommended `team_id uuid not null` at triage and lost; the four reasons
-- are in ADR-015 Rationale.
--
-- `unique (date)` IS LOAD-BEARING, NOT HYGIENE. It makes "the status of date D" a function rather
-- than a query, and the month shading, the year shading and the bridge-day derivation all depend on
-- that being single-valued. Two rows for one date with different kinds would make the working status
-- of a day ambiguous, and the ambiguity would surface as a derivation that is wrong at a
-- NEIGHBOURING date rather than at the duplicated one.
-- Its accepted cost: a date carrying two observances gets one row and one `name`.
create table if not exists public.holiday (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  name       text not null,
  kind       public.holiday_kind not null default 'non_working',
  created_at timestamptz not null default now()
);


-- ============================================================================================
-- SECTION 3 — The INV-01 exclusion constraint
--
-- Separate from the table because it is a separate statement in the migration, and because
-- `add constraint` has no `if not exists` form.
-- ============================================================================================

-- [SHIPPED] CAL-01. INV-01, ADR-011 section 3, verbatim.
--
-- Two rows conflict when all three hold: same member, intersecting dates, intersecting slots.
--   full vs am    [0,2) && [0,1)  -> true,  refused    ("full conflicts with everything")
--   am   vs pm    [0,1) && [1,2)  -> false, allowed    ("am and pm do not conflict")
--   full vs full  [0,2) && [0,2)  -> true,  refused
--
-- NEVER `portion with =`. With equality, a `full` entry and an `am` entry on one date have unequal
-- portions, the constraint does not fire, BOTH rows are accepted, and the member is recorded as both
-- fully and half absent on one day — which INV-04 then counts as 1.5 people away for one person.
-- Nothing errors. That failure passes every test written from the happy path, and it is the reason
-- ADR-011 exists rather than a line in a migration.
--
-- A REJECTED ENTRY STILL OCCUPIES ITS PORTION. There is no status carve-out here, by decision — so a
-- member whose entry was rejected cannot create a replacement on the same dates and must edit the
-- rejected one, which is why ADR-016 section 3 makes that path work.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'entry_no_overlapping_portion'
      and conrelid = 'public.entry'::regclass
  ) then
    alter table public.entry
      add constraint entry_no_overlapping_portion
      exclude using gist (
        member_id     with =,
        date_range    with &&,
        portion_slots with &&
      );
  end if;
end $$;


-- ============================================================================================
-- SECTION 4 — Functions
--
-- `create or replace` throughout, which is idempotent by nature and preserves the signature the
-- grants in SECTION 7 and the policies in SECTION 8 are written against.
-- ============================================================================================

-- [SHIPPED] TEA-01. The rank helper. `security definer` so that a policy on one table may consult
-- `member` without recursing through `member`'s own policies.
-- It filters `removed_at is null`: A REMOVED ADMIN IS NOT AN ADMIN.
create or replace function public.is_admin(p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member m
    where m.id = p_uid
      and m.role = 'admin'::public.member_role
      and m.removed_at is null
  );
$$;

-- [SHIPPED] TEA-01. Also filters `removed_at is null`, so a removed member's entries have no team —
-- the correct answer in both directions, and TEA-04's decision.
create or replace function public.member_team_id(p_uid uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select m.team_id from public.member m
  where m.id = p_uid and m.removed_at is null;
$$;

-- [SHIPPED] TEA-01. The whole membership feature — ADR-009 step 3.
--
-- search_path is `extensions` rather than '' because `allowed_email.email` is citext and the `=`
-- operator for it lives in that schema; with an empty search_path the comparison does not resolve.
-- Every relation below is fully qualified anyway, so nothing is reachable through the path itself.
--
-- TODO(verify): `new.raw_user_meta_data` is asserted by the installed @supabase/auth-js types rather
-- than read off the server's schema. Confirm against `\d auth.users` before this is applied.
create or replace function public.admit_allow_listed_member() returns trigger
  language plpgsql security definer set search_path = extensions as $$
declare
  v_now     timestamptz := now();
  v_team_id uuid;
begin
  -- AC-7: admit on confirmation, never on insert-without-confirmation. With Confirm email OFF
  -- Supabase sets email_confirmed_at at insert time, so this one trigger fires exactly once under
  -- either project setting and the two candidate behaviours stay indistinguishable, as AC-7 says.
  --
  -- INV-04 depends on this: the threshold is a share of the team's CURRENT member count, so an
  -- account created and never confirmed would raise the absence-count threshold for everybody
  -- without its owner ever being on the team.
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;   -- already admitted on an earlier confirmation
  end if;

  -- AC-2 and AC-3 in one statement. UPDATE ... RETURNING is atomic: two concurrent confirmations
  -- for the same address cannot both match `consumed_at is null`, so the second admits nobody.
  -- AC-4: citext, so the comparison is case-insensitive without a lower() anywhere.
  update public.allowed_email a
     set consumed_at = v_now
   where a.email = new.email
     and a.consumed_at is null
  returning a.team_id into v_team_id;

  if v_team_id is null then
    return new;   -- AC-5: not allow-listed, or already consumed. Sign-up still succeeds.
  end if;

  insert into public.member (id, team_id, display_name, avatar, role, created_at)
  values (
    new.id,
    v_team_id,                                    -- INV-07: the team comes from here and nowhere else
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
             split_part(new.email, '@', 1)),      -- AC-8, with a last-resort guard
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'avatar'), ''), '🙂'),
    'member'::public.member_role,                 -- AC-9. NEVER from raw_user_meta_data, which is
                                                  -- whatever the caller passed to signUp.
    v_now                                         -- AC-2: the same instant as consumed_at
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  -- A trigger on auth.users that raises makes signUp fail outright, which would break AC-5's
  -- "sign-up succeeds and returns the same result". The whole block rolls back together, so the
  -- allow-list entry is not consumed either. The warning is what makes the failure findable.
  raise warning 'admit_allow_listed_member failed for auth user %: %', new.id, sqlerrm;
  return new;
end;
$$;

-- [SHIPPED] TEA-04. What `WITH CHECK` cannot be: a policy sees only the new row, so no policy can
-- say "this column did not change" — rbac-and-security.md known weakness 6 states the limitation and
-- names this exact remedy, a BEFORE UPDATE trigger comparing OLD and NEW.
--
-- `security invoker`: the function needs no privilege of its own. It reads auth.uid() and nothing
-- else, so nothing is elevated and nothing has to be reasoned about.
create or replace function public.member_enforce_role_and_removal() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- AC-5. Demotion is denied for everybody, in every context. `Demote an admin to member` is denied
  -- for both roles in rbac-and-security.md, marked not decided — denied until it is. The refusal is
  -- asserted here rather than left to the absence of a control, because `role` is granted `update`
  -- for the promotion path and the column is therefore writable in exactly the direction that must
  -- be refused (ADR-005: a control that does not exist refuses nobody holding a token).
  if old.role = 'admin'::public.member_role and new.role is distinct from old.role then
    raise exception 'an admin may not be demoted' using errcode = '42501';
  end if;

  -- AC-10. `public.is_admin` filters `removed_at is null`, so a promoted removed member would hold a
  -- role that answers false everywhere — a row that says `admin` and behaves as nobody.
  if new.role is distinct from old.role and old.removed_at is not null then
    raise exception 'a removed member may not be promoted' using errcode = '42501';
  end if;

  -- Removal is one-way. Restoring a member is not a decided permission, and re-dating one is
  -- ADR-013's revert condition arriving as an ordinary UPDATE.
  if old.removed_at is not null and new.removed_at is distinct from old.removed_at then
    raise exception 'a removal may not be undone or re-dated' using errcode = '42501';
  end if;

  -- AC-9. A denial by DEFAULT rather than by decision, and narrower than the `Remove a member`
  -- permission row: the loss it prevents is a one-way door where the sole admin removes themselves,
  -- `is_admin` then answers false for everybody, no promotion is possible, and the roster is
  -- recoverable only by a human editing the database.
  --
  -- `v_uid is not null` so a migration, the SQL editor or a service-role call is not blocked —
  -- nothing blocks a service-role key anyway (known weakness 1). ADR-016 clause (a) does the same.
  if old.removed_at is null and new.removed_at is not null
     and v_uid is not null and old.id = v_uid then
    raise exception 'an admin may not remove themselves' using errcode = '42501';
  end if;

  -- AC-3. Provenance, never trusted from the wire. This is the column INV-04's denominator is
  -- defined against and ADR-013's per-date condition reads, so a caller-supplied or backdated value
  -- is not a data-entry mistake: it is a silent rewrite of every past absence count. The write
  -- SUCCEEDS and the supplied value is discarded.
  if old.removed_at is null and new.removed_at is not null then
    new.removed_at := now();
  end if;

  return new;
end;
$$;

-- ============================================================================================
-- public.entry_enforce_decision() — THE MERGED FORM. READ THIS COMMENT BEFORE EDITING IT.
--
-- This one function is the ONLY place three separate rules live, and that is ADR-016 section 1's
-- decision rather than a convenience. PostgreSQL fires same-event triggers ALPHABETICALLY BY NAME,
-- so a second `before update` trigger on `entry` would make the guard's correctness depend on
-- spelling. One function is what keeps the order explicit.
--
-- PROVENANCE IS MIXED INSIDE THIS BODY, uniquely in this file, and each clause is labelled:
--   [SHIPPED] the `updated_at` line   — CAL-02
--   [OWED]    clause (a) and (b)      — ADM-05, transcribed from ADR-016 section 1
--   [SHIPPED] clause (c)              — CAL-01, unchanged
--
-- The SHIPPED form of this function in supabase/migrations/20260903143000_cal02_own_entry_writes.sql
-- carries the `updated_at` line and clause (c) ONLY. Clauses (a) and (b) below have not been through
-- a PLAN gate. ADM-05 owes the migration that adds them, and it must use `create or replace` on this
-- same name.
--
-- ORDER INSIDE THE FUNCTION IS THE WHOLE DESIGN. The guard reads the values the client sent, before
-- any clause below has touched them. A member editing dates on an approved entry passes (a) — at
-- that point new.status still equals old.status — and is then reset by (c). Reverse the two and the
-- guard sees a `status` change MADE BY THE RESET ITSELF and refuses a member's legitimate edit.
--
-- `security invoker`: the function needs no privilege of its own. It reads auth.uid() and calls
-- public.is_admin, which is already `security definer` and already granted.
-- ============================================================================================
create or replace function public.entry_enforce_decision() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- [SHIPPED] CAL-02, AC-12. The datastore's own clock, never the client's: an UPDATE must name a
  -- value for every column it writes, and this line overwrites whatever a caller might send — which
  -- is why `updated_at` is absent from the update grant and cannot be sent at all. A timestamp a
  -- client can set is a record that can be backdated.
  new.updated_at := now();

  -- [OWED] ADM-05 — ADR-016 section 1, clause (a). THE GUARD. Only an admin may move the four
  -- decision columns.
  --
  -- THIS IS NOT EXPRESSIBLE AS A POLICY, and that is why it is here. An RLS `with check` sees the
  -- NEW row and has no OLD, so "`status` did not change" cannot be written; and CAL-02's
  -- `entry_update_own` admits a member's own row, so a raw PATCH {"status":"approved"} against it
  -- satisfies the policy and the entry is approved by the person who wrote it. A column grant cannot
  -- help either: `member` and `admin` are the SAME PostgreSQL role, `authenticated`, so revoking
  -- `status` from it blocks the admin too.
  --
  -- v_uid is null in a migration, the SQL editor or a service-role call; that context is not
  -- blocked, because nothing blocks a service-role key anyway (known weakness 1).
  if (new.status           is distinct from old.status
   or new.rejection_reason is distinct from old.rejection_reason
   or new.approved_by      is distinct from old.approved_by
   or new.approved_at      is distinct from old.approved_at)
     and v_uid is not null
     and not public.is_admin(v_uid) then
    raise exception 'only an admin may decide an entry'
      using errcode = '42501';
  end if;

  -- [OWED] ADM-05 — ADR-016 section 1, clause (b). PROVENANCE, NEVER TRUSTED FROM THE WIRE, IN
  -- EITHER DIRECTION. Before this, the only audit trail v1 has arrived in a PATCH body the admin
  -- composed, so one admin could write another admin's id into it and known weakness 3 means nothing
  -- would contradict them. It also makes CAL-05's "displaying who approved is not approving" true by
  -- construction rather than by convention.
  --
  -- Nulling `rejection_reason` on approval is FORCED, not chosen: the biconditional check
  -- `entry_rejection_reason_iff_rejected` refuses any transition off `rejected` that leaves the
  -- reason standing, and would surface as a raw 23514.
  if new.status = 'approved'::public.entry_status
     and old.status is distinct from 'approved'::public.entry_status then
    new.approved_by      := v_uid;
    new.approved_at      := now();
    new.rejection_reason := null;
  elsif new.status is distinct from 'approved'::public.entry_status then
    new.approved_by := null;
    new.approved_at := null;
  end if;

  -- [SHIPPED] CAL-01, and CAL-02 unchanged. INV-02, and the rejected-entry hole closed with it
  -- (ADR-016 section 3). RUNS LAST, ON PURPOSE — see the order note above.
  --
  -- A substantive edit revokes the decision: dates, type, portion and tentative are substantive;
  -- `note` alone is NOT, which is data-model.md's own carve-out.
  --
  -- It is ACTOR-BLIND on purpose: an admin's edit under CAL-03 revokes approval exactly as the
  -- owner's does. INV-02's text carries no actor qualifier.
  --
  -- Clearing `approved_by` and `approved_at` too is ADR-011 Consequences — a `pending` entry still
  -- naming its approver is the false record INV-02 exists to prevent.
  if (new.start_date is distinct from old.start_date
   or new.end_date   is distinct from old.end_date
   or new.type       is distinct from old.type
   or new.portion    is distinct from old.portion
   or new.tentative  is distinct from old.tentative)
     and old.status <> 'pending'::public.entry_status then
    new.status           := 'pending'::public.entry_status;
    new.approved_by      := null;
    new.approved_at      := null;
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

-- [OWED] ADM-06 — transcribed from ADR-016 section 4. No migration exists for this yet.
--
-- Bulk rejection is a function, NOT a PATCH with `id=in.(...)`. Verified there against the installed
-- @supabase/postgrest-js: `in()` appends the ids TO THE QUERY STRING at 37 bytes per uuid, so a few
-- hundred entries meets a proxy's request-line cap as an opaque 414 — at the exact moment an admin
-- clears a backlog, which is the only moment bulk rejection exists for. Chunking to avoid it
-- reintroduces the cross-chunk partial failure a single statement does not have.
--
-- `security invoker` IS WHAT KEEPS THIS INSIDE ADR-005. No authorization moves into the function:
-- `entry_update_admin` and clause (a) of the trigger both still run, AS THE CALLER, exactly as for a
-- single PATCH. It is a TRANSPORT change and not an enforcement layer. A `security definer` version
-- would be moving the check.
--
-- THE PARTIAL-FAILURE CASE THAT MUST REACH THE SEAM: rows an RLS policy does not admit are FILTERED
-- rather than errored, so "reject 8" updates 5 and returns success with no error. That is why this
-- returns `get diagnostics row_count` — the seam compares it against the selection size and says
-- "5 of 8" rather than "done". Failure, by contrast, is atomic: one statement, one transaction, so
-- if any row fails the check or the guard, NONE are rejected.
create or replace function public.reject_entries(p_ids uuid[], p_reason text) returns integer
  language plpgsql security invoker set search_path = '' as $$
declare v_n integer;
begin
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'a rejection carries a reason' using errcode = '22023';  -- INV-03, legibly
  end if;
  update public.entry
     set status = 'rejected'::public.entry_status, rejection_reason = p_reason
   where id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;


-- ============================================================================================
-- SECTION 5 — Triggers
--
-- `drop ... if exists` then `create`, which is idempotent on every PostgreSQL major. The whole file
-- is one transaction, so there is no window in which a guard is detached.
-- ============================================================================================

-- [SHIPPED] TEA-01. On auth.users, not on a public table. The trigger is the ONLY writer of
-- `member`: `member` must never gain an insert policy, because any insert policy a signed-in person
-- can satisfy lets them choose their own team_id and their own role, and the allow-list becomes a
-- suggestion while AC-9 becomes a convention.
drop trigger if exists admit_allow_listed_member on auth.users;
create trigger admit_allow_listed_member
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.admit_allow_listed_member();

-- [SHIPPED] TEA-04.
drop trigger if exists member_enforce_role_and_removal on public.member;
create trigger member_enforce_role_and_removal
  before update on public.member
  for each row execute function public.member_enforce_role_and_removal();

-- [SHIPPED] CAL-01. THE NAME IS LOAD-BEARING — see the comment on the function in SECTION 4.
drop trigger if exists entry_enforce_decision on public.entry;
create trigger entry_enforce_decision
  before update on public.entry
  for each row execute function public.entry_enforce_decision();


-- ============================================================================================
-- SECTION 6 — Row-level security, and the revokes
--
-- EXPLICIT, NOT INHERITED. Supabase's default privileges on a new table in `public` are permissive;
-- relying on them would leave the policy as the only thing between `anon` and a write, and
-- rbac-and-security.md known weakness 1 is precisely that a policy fails open silently.
--
-- Under ADR-005 there is no server: the browser holds the user's own token and talks to PostgREST
-- directly. RLS IS NOT THE LAST LINE OF DEFENCE, IT IS THE ONLY ONE.
-- ============================================================================================

-- [SHIPPED] TEA-01.
alter table public.team          enable row level security;
alter table public.member        enable row level security;
alter table public.allowed_email enable row level security;
revoke all on public.team, public.member, public.allowed_email from anon, authenticated;

-- [SHIPPED] CAL-01. A separate statement because `entry` did not exist when TEA-01 ran.
alter table public.entry enable row level security;
revoke all on public.entry from anon, authenticated;

-- [OWED] ADM-02 — ADR-015 section 3.
alter table public.holiday enable row level security;
revoke all on public.holiday from anon, authenticated;


-- ============================================================================================
-- SECTION 7 — Grants
--
-- A POLICY ALONE READS NOTHING, and a grant alone admits nothing. Both are required, every time.
-- This repository has found that trap four times (TEA-01, ADR-016 Consequences, CAL-02 step 2, and
-- ADM-01 on `team`), which is why every grant below sits beside a named policy in SECTION 8.
--
-- `to authenticated`, NEVER `to public`: the anon key ships in the browser bundle by design
-- (rbac-and-security.md, Secrets).
-- ============================================================================================

-- [SHIPPED] TEA-01. Function execute.
revoke all on function public.is_admin(uuid), public.member_team_id(uuid) from public;
grant execute on function public.is_admin(uuid), public.member_team_id(uuid) to authenticated;

-- [SHIPPED] TEA-01.
grant select on public.member        to authenticated;
grant select on public.allowed_email to authenticated;

-- [SHIPPED] TEA-02. Writes need their own grants; a policy cannot admit a statement the role has no
-- privilege to issue. There is deliberately NO update grant on allowed_email: an entry that is wrong
-- is removed and re-added, which keeps added_by and added_at describing an act that happened.
grant insert, delete on public.allowed_email to authenticated;

-- [SHIPPED] TEA-04. NOT a blanket `grant update on public.member`, and that is the whole statement.
-- Nobody — not a member, not an admin — may write `id`, `team_id`, `display_name`, `avatar` or
-- `created_at`, so the privilege is simply WITHHELD and a statement naming any of them is refused
-- with `42501 permission denied for column` before any policy runs.
--
-- This is the shape that WORKS on `member` and `team` and does NOT work on `entry`: a column grant
-- cannot distinguish who is writing, so it works exactly where the answer is "nobody". `team_id` is
-- the one that matters and it is INV-07 — a writable team_id moves a member between teams and every
-- entry they own is counted against the new one.
grant update (role, removed_at) on public.member to authenticated;

-- [SHIPPED] CAL-01. The read grant, and the insert grant WHOSE COLUMN LIST IS THE CONTROL.
--
-- `status`, `rejection_reason`, `approved_by`, `approved_at`, `id`, `created_at`, `updated_at`,
-- `date_range` and `portion_slots` are all absent deliberately. An admin approves by UPDATING an
-- entry under ADM-05, never by creating one already approved.
--
-- `member_id` IS in the insert list, and must be: it is not-null with no default. What stops a
-- caller naming somebody else is `entry_insert_own`, not this.
grant select on public.entry to authenticated;
grant insert (member_id, type, portion, start_date, end_date, tentative, note)
  on public.entry to authenticated;

-- [SHIPPED] CAL-02. The update grant, and its column list is the control for the member's edit path.
-- `member_id` absent is INV-07 — permanently, and not ADM-05's to add either.
grant update (start_date, end_date, type, portion, tentative, note)
  on public.entry to authenticated;

-- [SHIPPED] CAL-02. `delete` is a TABLE-level privilege with no column form, and CAL-01's
-- `revoke all` was table-wide — so the delete policies are not sufficient on their own and neither
-- is this. Both are required.
grant delete on public.entry to authenticated;

-- [OWED] ADM-05 — ADR-016 Consequences. No migration exists for this yet.
--
-- CAL-02 step 1 DEFERRED EXACTLY THESE TWO COLUMNS BY NAME, and the reason is why they must not be
-- granted without clauses (a) and (b) of `entry_enforce_decision()` in the same change: granting
-- `status` while the function is in its INV-02-only form hands every member the exact write ADR-016
-- exists to refuse, with no guard behind it. In this file both arrive together — see SECTION 4.
grant update (status, rejection_reason) on public.entry to authenticated;

-- [OWED] ADM-02 — ADR-015 section 3. The table grant is not inherited: TEA-01's revoke names its
-- three tables because `holiday` did not exist.
grant select on public.holiday to authenticated;

-- [OWED] ADM-03 — ADR-015 section 3.
grant insert, update, delete on public.holiday to authenticated;

-- [OWED] ADM-06 — ADR-016 section 4.
revoke all on function public.reject_entries(uuid[], text) from public;
grant execute on function public.reject_entries(uuid[], text) to authenticated;


-- ============================================================================================
-- SECTION 8 — Row-level security policies
--
-- POLICIES ARE PERMISSIVE AND OR TOGETHER. Where two policies cover one table and command, they
-- compose by the engine's own rule rather than by an author merging two predicates into one. A
-- reviewer who finds an earlier policy modified to accommodate a later one has found the defect.
--
-- Every `(select auth.uid())` is wrapped deliberately: it lets the planner evaluate it once per
-- statement rather than once per row.
--
-- `drop ... if exists` then `create`, for idempotence.
-- ============================================================================================

-- --- public.member -------------------------------------------------------------------------

-- [SHIPPED] TEA-01. Addresses only the caller's own id, so "no row" and "a row I may not see"
-- collapse into one answer. KEPT, not replaced, by TEA-03 below: replacing it would leave a removed
-- member unable to read even their own row, because `member_team_id` filters `removed_at is null`
-- and `team_id = null` is never true — byte-identical to the answer for somebody never admitted.
drop policy if exists member_select_own on public.member;
create policy member_select_own on public.member
  for select to authenticated
  using (id = (select auth.uid()));

-- [SHIPPED] TEA-03, ADR-018. INV-07 now lives in exactly one predicate.
--
-- NO `removed_at` CONDITION, by decision (ADR-018 point 2): a removed member's row is returned to
-- their teammates CARRYING `removed_at`, because ADR-013 and the INV-04 note require the counting
-- function to be GIVEN the roster with `removed_at` per member — it cannot derive
-- membership-as-of-a-date from the entries. Which rows the SCREEN draws is a display decision above
-- the seam; which rows the READ returns is not.
--
-- ADR-018's revert condition is any read of public.member returning a row belonging to a team the
-- caller is not on — ONE occurrence, no threshold.
drop policy if exists member_select_team on public.member;
create policy member_select_team on public.member
  for select to authenticated
  using (team_id = public.member_team_id((select auth.uid())));

-- [SHIPPED] TEA-04. NO INSERT POLICY AND NO DELETE POLICY ON public.member, PERMANENTLY (ADR-020,
-- ADR-018 point 3 as narrowed). The admission trigger is the only creator of a member row; a delete
-- is refused by `on delete restrict` anyway and would destroy the `removed_at` ADR-013 requires.
--
-- The `with check` is REDUNDANT while `team_id` is ungranted, and is kept as the second lock: if a
-- later ticket ever grants that column, this policy already refuses a move across teams.
drop policy if exists member_update_admin on public.member;
create policy member_update_admin on public.member
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
  )
  with check (
    team_id = public.member_team_id((select auth.uid()))
  );

-- --- public.allowed_email ------------------------------------------------------------------

-- [SHIPPED] TEA-01. A member receives no rows; an admin receives their own team's entries, consumed
-- and unconsumed alike.
drop policy if exists allowed_email_select_admin on public.allowed_email;
create policy allowed_email_select_admin on public.allowed_email
  for select to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
  );

-- [SHIPPED] TEA-02. `with check` and not `using`: an insert has no existing row to test.
--
-- The team is DERIVED from the caller rather than accepted from them, so no client has a path to
-- another team's. INV-07 is decided here: allowed_email.team_id is the value the admission trigger
-- copies onto the member row.
--
-- `added_by = auth.uid()` is deliberate: without it an admin could attribute an entry to a
-- colleague, and data-model.md calls `added_by` the only provenance for who let somebody in.
drop policy if exists allowed_email_insert_admin on public.allowed_email;
create policy allowed_email_insert_admin on public.allowed_email
  for insert to authenticated
  with check (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
    and added_by = (select auth.uid())
    and consumed_at is null
  );

-- [SHIPPED] TEA-02. `consumed_at is null` is HERE rather than in the interface: a consumed row is
-- invisible to this policy, so the delete matches nothing whoever issues it. Hiding the remove
-- control on a joined row is the affordance over this and never the check itself (ADR-005).
drop policy if exists allowed_email_delete_admin_unconsumed on public.allowed_email;
create policy allowed_email_delete_admin_unconsumed on public.allowed_email
  for delete to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
    and consumed_at is null
  );

-- --- public.entry --------------------------------------------------------------------------

-- [SHIPPED] CAL-01. `Read any entry in the team` is checked for BOTH roles in rbac-and-security.md,
-- which is what makes a note readable by the whole team — it follows mechanically from this being a
-- row-level select policy under ADR-005 rather than from any screen.
drop policy if exists entry_select_team on public.entry;
create policy entry_select_team on public.entry
  for select to authenticated
  using (
    public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
  );

-- [SHIPPED] CAL-01. UNIFORM ACROSS ROLES, with no role predicate at all: `Create an entry on behalf
-- of another member` is a denial by default for both roles, so the admin has no more power here than
-- the member. One `with check` admitting no value other than the caller's own id is the shortest
-- correct expression of that, and therefore the hardest to write wrongly. INV-07 is the not-null
-- reference on member_id plus this.
--
-- CAL-03 must never add an admin insert policy; this stays the only insert path for everybody.
drop policy if exists entry_insert_own on public.entry;
create policy entry_insert_own on public.entry
  for insert to authenticated
  with check (member_id = (select auth.uid()));

-- [SHIPPED] CAL-02. NO ROLE PREDICATE: `Edit their own entry` is checked for both roles, and an
-- admin has no more power here than a member. The admin's extra capability is over OTHER members'
-- entries, which is entry_update_admin below.
--
-- `using` sees the OLD row and decides which rows the caller may touch at all — and it is a FILTER
-- rather than an error: a row that does not match is not visible to the statement, so PostgREST
-- answers 200 with an empty body and THE SEAM MUST COUNT ROWS RATHER THAN TRUSTING `!error`.
drop policy if exists entry_update_own on public.entry;
create policy entry_update_own on public.entry
  for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));

-- [SHIPPED] CAL-02. A HARD delete — `entry` carries no soft-delete column, so the row and its
-- approved_by disappear together, and INV-01's constraint releases the slots the moment it is gone.
drop policy if exists entry_delete_own on public.entry;
create policy entry_delete_own on public.entry
  for delete to authenticated
  using (member_id = (select auth.uid()));

-- [SHIPPED] CAL-03. THE TEAM PREDICATE IS LOAD-BEARING AND IS THE HALF WITH NO TEST BEHIND IT. A
-- policy of `using (public.is_admin((select auth.uid())))` alone reads correct, passes every test
-- that can be written against the one-team fixture this repository has, and lets an admin of ANY
-- team edit EVERY entry in the product at P2. That is known weakness 1 — a policy written too
-- permissively fails open and SILENTLY.
--
-- `using` CARRIES is_admin AND `with check` DOES NOT, and the asymmetry is deliberate. `using` sees
-- the OLD row and answers "may this caller touch this row at all" — that is where the role belongs.
-- `with check` sees the NEW row and must catch a MOVE ACROSS TEAMS, which `using` structurally
-- cannot see because it is evaluated against the old row's team.
--
-- INV-01 NEEDS NOTHING HERE: `entry_no_overlapping_portion` keys on member_id, so an admin editing
-- somebody else's row collides with THAT MEMBER's other entries and never with the admin's own.
drop policy if exists entry_update_admin on public.entry;
create policy entry_update_admin on public.entry
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
  )
  with check (
    public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
  );

-- [SHIPPED] CAL-03. The same team predicate, and it is not shortened because the delete "reads
-- smaller": a delete across teams is the more destructive half of the same hole.
drop policy if exists entry_delete_admin on public.entry;
create policy entry_delete_admin on public.entry
  for delete to authenticated
  using (
    public.is_admin((select auth.uid()))
    and public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
  );

-- --- public.holiday ------------------------------------------------------------------------

-- [OWED] ADM-02 — ADR-015 section 3. No migration exists for this yet.
--
-- `using (true)` IS CORRECT HERE AND WOULD BE A LEAK ANYWHERE ELSE IN THIS SCHEMA. A holiday row
-- carries no member, no team and no personal data; it is a public fact about the Vietnamese
-- calendar. glossary.md: "Holidays belong to the calendar, not to any member." Every other table in
-- this model is scoped by member or by team, and a reviewer should read this comment as the reason
-- the exception is warranted rather than as an oversight.
drop policy if exists holiday_select_all on public.holiday;
create policy holiday_select_all on public.holiday
  for select to authenticated using (true);

-- [OWED] ADM-03 — ADR-015 section 3. No migration exists for these three yet.
--
-- One power — "Add, edit or delete a holiday or swap day", member no, admin yes — and THREE
-- policies, because PostgreSQL has no single `for write`.
--
-- public.is_admin(uuid) needs no grant here: TEA-01 already granted execute on it to
-- `authenticated`, and it is `security definer` so a policy on this table may consult `member`
-- without recursing through `member`'s own policies. A second grant would read as a control and be
-- none. The TABLE grant in SECTION 7 is the one that is not inherited.
drop policy if exists holiday_insert_admin on public.holiday;
create policy holiday_insert_admin on public.holiday
  for insert to authenticated
  with check (public.is_admin((select auth.uid())));

drop policy if exists holiday_update_admin on public.holiday;
create policy holiday_update_admin on public.holiday
  for update to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

drop policy if exists holiday_delete_admin on public.holiday;
create policy holiday_delete_admin on public.holiday
  for delete to authenticated
  using (public.is_admin((select auth.uid())));


commit;


-- ============================================================================================
-- ============================================================================================
-- SECTION 9 — WHAT IS DELIBERATELY NOT IN THIS FILE
--
-- THREE THINGS ARE MISSING, AND TWO OF THEM CHANGE BEHAVIOUR YOU WILL OTHERWISE MEET AS A BUG.
-- Nothing below is an oversight. Each is missing because NOBODY HAS DECIDED IT, and ADR-026
-- decision point 2 forbids this file from inventing one — an object enters it only if an accepted
-- ADR writes the statement out in full.
-- ============================================================================================
-- ============================================================================================
--
--
-- 9.1 — public.team HAS NO SELECT POLICY AND NO SELECT GRANT.
--       Owner: CAL-04 (`Month view`). Blocked behind: nothing. Simply not built yet.
--
--       *** THE CONSEQUENCE, IN BEHAVIOUR: NO CLIENT CAN READ public.team AT ALL. ***
--       Row-level security is enabled on it in SECTION 6 and `revoke all ... from anon,
--       authenticated` runs there too, and no policy and no grant follow. So the table is CLOSED,
--       not open — this is safe, and it is not working. `overload_threshold` is unreadable, which
--       means the overload comparison (INV-04) cannot be performed by any signed-in caller, and any
--       screen that tries gets an empty result rather than an error.
--
--       What is missing, and why it is not written here: the .ai/registry/features.md CAL-04 row
--       assigns BOTH the policy and `grant select on public.team to authenticated` to CAL-04, and
--       says so in terms. No accepted document names the POLICY or its predicate. A plan exists that
--       proposes `team_select_own`, and it carries `gate: BLOCKED` — so writing it here would answer
--       a blocked ticket's blocking question somewhere else.
--
--
-- 9.2 — public.team HAS NO UPDATE POLICY AND NO `grant update (overload_threshold)`.
--       Owner: ADM-01 (`Set the overload threshold`). STATUS: THE TICKET IS BLOCKED.
--
--       The consequence: an admin cannot change the threshold. It stays at the column default, 0.5.
--
--       The grant IS decided — the ADM-01 feature row writes
--       `grant update (overload_threshold) on public.team to authenticated` out verbatim, and
--       explains why it is not optional: AN RLS UPDATE POLICY IS ROW-LEVEL, so it permits updating
--       EVERY COLUMN OF THE ROW IT ADMITS, INCLUDING `name`. There is no permission row anywhere for
--       renaming the team. Without the column grant beside it, "set the threshold" silently becomes
--       "edit the team row".
--
--       The POLICY is not decided, and ADM-01's blocking question is whether it may also take 9.1's
--       select policy — which is a .ai/registry/features.md ownership change and therefore human-only
--       under RULE-01. That is with the operator.
--
--
-- 9.3 — public.holiday IS CREATED AND EMPTY. THE NATIONAL HOLIDAY DATES ARE NOT SEEDED.
--       Owner: ADM-02. This one does NOT break a screen; it makes one truthful and useless.
--
--       The table, its enum, its RLS, its grants and all four policies ARE above, transcribed from
--       ADR-015 section 3. What is absent is the DATA — the several years of Vietnamese public
--       holidays and announced swap days, which ADR-015 section 5 specifies as a DATA MIGRATION of
--       the form:
--
--           insert into public.holiday (date, name, kind) values
--             ('2026-04-30', 'Ngay Giai phong mien Nam', 'non_working'),
--             ...
--           on conflict (date) do nothing;
--
--       `on conflict (date) do nothing` rather than `do update` IS THE LOAD-BEARING PART: it lets an
--       admin's correction of a government announcement survive re-application, where `do update`
--       would silently overwrite the one piece of knowledge in this table that no seed could ever
--       have supplied.
--
--       Why the rows are not here: ADR-015 section 5 writes ONE row and then an ellipsis. How many
--       years the seed covers is an open TODO(project) on the ADM-02 feature row — the operator said
--       "several", and several is not a testable criterion. And the dates themselves are facts about
--       Vietnamese government announcements, not facts in this repository; writing them from recall
--       is what .ai/standards/tech-stack.md forbids, in the one table where a wrong date SILENTLY
--       MOVES BRIDGE-DAY DETECTION FOR THE WHOLE TEAM — non-locally, since a wrong Thursday row
--       removes or invents FRIDAY's bridge highlight and nobody looking at Friday suspects Thursday.
--
--       Until rows exist, every date is an ordinary working day and no bridge day is ever drawn.
--
--
-- 9.4 — NOT MISSING, BUT NOT HERE EITHER: the first team and the first admin.
--       This file creates no rows at all. `admit_allow_listed_member` only ever admits a MEMBER, so
--       the first admin cannot arrive through the product. supabase/seed.sql is the
--       TEST-AND-DEVELOPMENT seed and is a separate, human-applied file with its own contract —
--       ADR-024. Standing up a usable project needs one team row and one admin member row, by hand.
--
--
-- ============================================================================================
-- END. Applying this file is human (RULE-09). No agent runs it.
-- ============================================================================================
