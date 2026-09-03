-- TEA-01 seed. Applied by a human (RULE-09), never by an agent.
--
-- This is the TEST-AND-DEVELOPMENT seed, not the production bootstrap. The story puts the first team
-- and the first admin out of scope as a capability of the feature and says a human applies a seed;
-- this file is what a human applies. It is in scope for TEA-01 only because AC-3, AC-11 and AC-12
-- have nothing to run against without it, and .ai/standards/testing-standards.md requires tests to
-- share the seed rather than invent entities inline.
--
-- EVERY literal below also appears in src/lib/fixtures.ts, which is what the mock seam and the tests
-- read. Change a value here and change it there in the same commit — the two drifting is the exact
-- failure the shared-fixture rule exists to prevent.
--
-- Insert order is forced by the foreign keys, none of which cascade: team -> auth user -> member
-- -> allowed_email (`added_by` references `member`, whose id references `auth.users`).

insert into public.team (id, name, overload_threshold, created_at)
values (
  '11111111-1111-4111-8111-111111111111',
  'CaleChip',
  0.5,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- The seeded first admin's auth user.
--
-- `email_confirmed_at` is set, so `admit_allow_listed_member` fires on this insert. It finds no
-- allow-list entry for this address — there is none, and there must not be one — and returns without
-- creating anything. The admin's `member` row is inserted below by this seed instead, which is the
-- one place in the system a member row is written by something other than the trigger, and it is a
-- human running a seed rather than a policy anyone can reach.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- These four have NO column default. Left NULL, GoTrue scans them into non-nullable Go
  -- strings and every sign-in for the row fails with `500 Database error querying schema`,
  -- while a sign-in for a user that does not exist still returns 400. MD-014.
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-222222222222',
  'authenticated',
  'authenticated',
  'quan@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-08-31T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Quản trị","avatar":"🦉"}'::jsonb,
  '2026-08-31T00:00:00+00:00',
  '2026-08-31T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, team_id, display_name, avatar, role, removed_at, created_at)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Quản trị',
  '🦉',
  'admin',
  null,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- Two allow-list entries, and the pair is the point: one unconsumed and one consumed, so AC-3 has
-- something to assert against rather than having to consume the first entry as a side effect of an
-- earlier test.
insert into public.allowed_email (email, team_id, added_by, added_at, consumed_at)
values
  -- Unconsumed: AC-1, AC-2 and AC-4 sign up as this address.
  (
    'an@example.com',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '2026-08-31T00:00:00+00:00',
    null
  ),
  -- Consumed: AC-3. It is on the list and must admit nobody.
  (
    'binh@example.com',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '2026-08-31T00:00:00+00:00',
    '2026-08-31T00:00:00+00:00'
  )
on conflict (email) do nothing;

-- `khach@example.com` is deliberately absent. It is FIXTURE_UNLISTED_EMAIL, and AC-5 needs an
-- address that is on no list at all.

-- ---------------------------------------------------------------------------
-- Operator's own admin account, added 2026-09-01 on direct instruction.
--
-- Same shape as the seeded admin above: an auth.users row whose password is
-- hashed with bcrypt, then a member row carrying role 'admin'. The trigger
-- `admit_allow_listed_member` only ever admits a MEMBER, so the first admin of a
-- team cannot come through sign-up and has to be seeded — which is why this
-- block exists rather than an allow_email entry.
--
-- The password here is deliberately weak and is a development credential. It
-- must not survive contact with real data.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- These four have NO column default. Left NULL, GoTrue scans them into non-nullable Go
  -- strings and every sign-in for the row fails with `500 Database error querying schema`,
  -- while a sign-in for a user that does not exist still returns 400. MD-014.
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-4333-8333-333333333333',
  'authenticated',
  'authenticated',
  'admin@calachip.com',
  extensions.crypt('123456', extensions.gen_salt('bf')),
  '2026-09-01T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Admin","avatar":"\u2b50"}'::jsonb,
  '2026-09-01T00:00:00+00:00',
  '2026-09-01T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, team_id, display_name, avatar, role, removed_at, created_at)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Admin',
  '\u2b50',
  'admin',
  null,
  '2026-09-01T00:00:00+00:00'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- TEA-03. 02-design.md section 4.1.
--
-- Three rows the story's criteria have nothing to run against without: a second team, a member on
-- it (AC-2), and a removed member on the first team (AC-4). Every literal below also appears in
-- src/lib/fixtures.ts as FIXTURE_OTHER_TEAM, FIXTURE_OTHER_TEAM_MEMBER and FIXTURE_REMOVED_MEMBER.
--
-- Why they are seeded rather than created by a test. Exactly one team exists in v1, so AC-2 is
-- unobservable through the interface: a one-team fixture passes whether the team scope is in
-- `member_select_team`'s predicate or absent from it. ADR-018's revert condition names this data
-- specifically. AC-4 is the same shape one layer down — an all-active roster cannot show whether
-- the read kept a removed member or dropped one.
--
-- Insert order is forced by the foreign keys and none of them cascade: team -> auth user -> member.
-- Each auth.users insert sets confirmation_token, recovery_token, email_change_token_new and
-- email_change to '' — MD-014, the same reason every seeded account above does.
-- ---------------------------------------------------------------------------

insert into public.team (id, name, overload_threshold, created_at)
values (
  '44444444-4444-4444-8444-444444444444',
  'Nhóm khác',
  0.5,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- AC-2. A member of the OTHER team. No read by anybody on the first team may ever return this row.
--
-- `email_confirmed_at` is set, so `admit_allow_listed_member` fires on this insert. It finds no
-- allow-list entry for this address — there is none, and there must not be one, or the trigger would
-- put this person on the FIRST team and destroy the criterion — and returns having created nothing.
-- The member row below is this seed's write, as it is for the two admins above.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '66666666-6666-4666-8666-666666666666',
  'authenticated',
  'authenticated',
  'chi@other.example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-08-31T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Người nhóm khác","avatar":"🐰"}'::jsonb,
  '2026-08-31T00:00:00+00:00',
  '2026-08-31T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, team_id, display_name, avatar, role, removed_at, created_at)
values (
  '66666666-6666-4666-8666-666666666666',
  '44444444-4444-4444-8444-444444444444',
  'Người nhóm khác',
  '🐰',
  'member',
  null,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- AC-4. A REMOVED member of the first team. `member_select_team` does not filter `removed_at`, so
-- this row is returned to their teammates carrying it — ADR-013 and the INV-04 note require the
-- counting function to be given the roster with `removed_at` per member. The screen does not draw
-- them; the read does return them, and those are two different layers.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-4777-8777-777777777777',
  'authenticated',
  'authenticated',
  'cu@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-08-31T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Đã rời nhóm","avatar":"🐶"}'::jsonb,
  '2026-08-31T00:00:00+00:00',
  '2026-08-31T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, team_id, display_name, avatar, role, removed_at, created_at)
values (
  '77777777-7777-4777-8777-777777777777',
  '11111111-1111-4111-8111-111111111111',
  'Đã rời nhóm',
  '🐶',
  'member',
  '2026-08-31T12:00:00+00:00',
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- TEA-04. 01-plan.md section 6.1.
--
-- One row, and it is a SECOND ADMIN on the first team. AC-13 asserts that an admin viewing the
-- roster sees a remove control and NO promote control on a row whose role is already `admin`, and
-- with FIXTURE_ADMIN the only admin on this team the caller and that row are the same row — so the
-- criterion is unobservable and passes whether the promote control is correctly withheld or the
-- caller's own row is simply being skipped. It also makes AC-9 concrete: with two admins, refusing
-- self-removal costs nobody the ability to leave.
--
-- Every literal below also appears in src/lib/fixtures.ts as FIXTURE_SECOND_ADMIN.
--
-- `email_confirmed_at` is set, so `admit_allow_listed_member` fires on this insert. It finds no
-- allow-list entry for this address — there is none, and there must not be one — and returns having
-- created nothing. The member row below is this seed's write, as it is for every admin above.
-- Insert order is forced by the foreign keys: auth user -> member. The four token columns are set
-- to '' for the reason MD-014 records and every seeded account above repeats.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '88888888-8888-4888-8888-888888888888',
  'authenticated',
  'authenticated',
  'dung@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-08-31T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Quản trị hai","avatar":"🦊"}'::jsonb,
  '2026-08-31T00:00:00+00:00',
  '2026-08-31T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, team_id, display_name, avatar, role, removed_at, created_at)
values (
  '88888888-8888-4888-8888-888888888888',
  '11111111-1111-4111-8111-111111111111',
  'Quản trị hai',
  '🦊',
  'admin',
  null,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- TEA-05. 01-plan.md section 5.1.
--
-- Three accounts, and the first of them is a REPAIR rather than an addition.
--
-- `FIXTURE_MEMBER` (55555555-…) is in src/lib/fixtures.ts and in the mock's seeded roster and has
-- had NO ROW HERE since TEA-02 added it. So the only member-role account in the product was
-- unseeded, and against a real project AC-10's *"and when their role is member, no such link is
-- shown"* had nobody to be. The shared-fixture rule in .ai/standards/testing-standards.md exists for
-- exactly this: a fixture that lives in one file drifts from the seed and produces failures that
-- reproduce in CI and not locally.
--
-- `FIXTURE_MEMBER_LESS` (99999999-…) is AC-4's account: confirmed, and on no team. It is what
-- sign-up produces for an address that was not on the allow-list — the trigger fires on
-- `email_confirmed_at`, finds no entry for the address, and creates nothing. There is deliberately
-- NO allow_email row for it and there must not be one, or the trigger would admit them and destroy
-- the criterion. No `member` insert follows it, for the same reason.
--
-- `FIXTURE_UNCONFIRMED` (aaaaaaaa-…) is AC-3's account, and it is the one row here with
-- `email_confirmed_at` NULL. `admit_allow_listed_member` returns early on a null value, so this
-- account has no member row either; GoTrue refuses its sign-in with `email_not_confirmed` before
-- membership is ever consulted. It is the state TEA-01's AC-7 creates on purpose — confirmation is
-- on — so a person reaches it by following the instructions, and AC-3 is the product answering them
-- honestly instead of telling them their password is wrong.
--
-- Every literal below also appears in src/lib/fixtures.ts, in FIXTURE_CREDENTIALS. Insert order is
-- forced by the foreign keys: auth user -> member. The four token columns are set to '' for the
-- reason MD-014 records and every seeded account above repeats — left NULL, GoTrue scans them into
-- non-nullable Go strings and EVERY sign-in for the row fails with `500 Database error querying
-- schema`. This is the ticket where that defect bites hardest, because sign-in is the whole subject.
-- ---------------------------------------------------------------------------

-- FIXTURE_MEMBER. The member-role half of AC-10, and the drift repaired.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-4555-8555-555555555555',
  'authenticated',
  'authenticated',
  'thanh@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-08-31T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Thành viên","avatar":"🐱"}'::jsonb,
  '2026-08-31T00:00:00+00:00',
  '2026-08-31T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, team_id, display_name, avatar, role, removed_at, created_at)
values (
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'Thành viên',
  '🐱',
  'member',
  null,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- FIXTURE_MEMBER_LESS. AC-4. Confirmed, and NO member row follows on purpose.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '99999999-9999-4999-8999-999999999999',
  'authenticated',
  'authenticated',
  'hoa@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-09-01T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Chưa vào nhóm","avatar":"🐧"}'::jsonb,
  '2026-09-01T00:00:00+00:00',
  '2026-09-01T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

-- FIXTURE_UNCONFIRMED. AC-3. `email_confirmed_at` is NULL, so the trigger returns early and this
-- account has no member row either. No member insert follows.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'authenticated',
  'authenticated',
  'khanh@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  null,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Chưa xác nhận","avatar":"🐸"}'::jsonb,
  '2026-09-01T00:00:00+00:00',
  '2026-09-01T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- CAL-02. 01-plan.md section 7.
--
-- One account and one entry, and the entry is the reason for both: AC-5 and AC-6 edit an entry that
-- is ALREADY APPROVED, and nothing in the product can create one. `entry_insert_own`'s grant
-- excludes `status`, CAL-02's own update grant excludes it too, and ADM-05 does not exist — so an
-- approved entry exists only if a human seeds it, which is what this block is.
--
-- The owner is a THIRD member-role account rather than FIXTURE_MEMBER, and that is forced rather
-- than chosen: tests/e2e/cal-01-create-entry.spec.ts asserts `own-entries-empty` for
-- thanh@example.com and exact row counts for quan@example.com, and CAL-02 01-plan.md section 4.3
-- requires that suite to pass UNEDITED. Seeding an entry under either address breaks it.
--
-- Both literals also appear in src/lib/fixtures.ts, as FIXTURE_APPROVED_MEMBER,
-- FIXTURE_APPROVED_MEMBER_CREDENTIAL and FIXTURE_APPROVED_ENTRY. Insert order is forced by the
-- foreign keys: auth user -> member -> entry. The four token columns are set to '' for the reason
-- MD-014 records and every seeded account above repeats.
--
-- `email_confirmed_at` is set, so `admit_allow_listed_member` fires on this insert. It finds no
-- allow-list entry for this address — there is none, and there must not be one — and returns having
-- created nothing. The member row below is this seed's write, as it is for every seeded account.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'authenticated',
  'authenticated',
  'linh@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-09-01T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Đã duyệt","avatar":"🐨"}'::jsonb,
  '2026-09-01T00:00:00+00:00',
  '2026-09-01T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, team_id, display_name, avatar, role, removed_at, created_at)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '11111111-1111-4111-8111-111111111111',
  'Đã duyệt',
  '🐨',
  'member',
  null,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- The approved entry itself. `approved_by` and `approved_at` are BOTH set: INV-02's subject is a
-- decision that must not survive a substantive edit, and an entry seeded `approved` with no approver
-- would let AC-5 pass against a trigger that clears nothing.
--
-- `rejection_reason` stays null because `status` is `approved` — `entry_rejection_reason_iff_rejected`
-- is a biconditional and refuses any other combination.
--
-- `updated_at` EQUALS `created_at`, which is what the datastore stores for a row that has never been
-- updated. AC-12 asserts that an edit moves it, and it is observable only because the two start
-- equal. This insert names both columns explicitly rather than taking the defaults, so the seed is
-- reproducible on any day it is applied.
--
-- This statement is a HUMAN's (RULE-09), and it names columns no policy grants `authenticated` —
-- which is the point: a seed runs as the owner, and the product cannot reach this state.
insert into public.entry (
  id, member_id, type, portion, start_date, end_date, tentative,
  status, rejection_reason, note, approved_by, approved_at, created_at, updated_at
)
values (
  'dd000000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'pto',
  'full',
  '2026-09-14',
  '2026-09-16',
  false,
  'approved',
  null,
  'Nghỉ đã được duyệt',
  '22222222-2222-4222-8222-222222222222',
  '2026-09-01T02:00:00+00:00',
  '2026-09-01T01:00:00+00:00',
  '2026-09-01T01:00:00+00:00'
)
on conflict (id) do nothing;
