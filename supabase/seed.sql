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
