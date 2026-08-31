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
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
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
  '2026-08-31T00:00:00+00:00'
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
