-- MIR-09 AC-1, AC-2, AC-3. ADR-069. 01-plan.md §§ 2, 4.
begin;
\ir _isolation.psql
select plan(13);
select tests.seed();

-- AC-1: the index exists, on exactly the column `team_id`.
select has_index('public', 'member', 'member_team_id_idx', array['team_id'],
  'AC-1: public.member has member_team_id_idx on (team_id)');

-- AC-2, AC-3. As an approved admin of team T.
select tests.authenticate_as(tests.id('admin_t'));
select is(current_user::text, 'authenticated', 'runs as authenticated');

-- AC-2: each out-of-range or non-finite value is refused with 23514, and nothing is written.
select throws_ok(
  format($$update public.team set overload_threshold = %L where id = %L$$, 1.01, tests.id('team_t')),
  '23514', null, 'AC-2 admin_t: 1.01 is refused (23514)');
select throws_ok(
  format($$update public.team set overload_threshold = %L where id = %L$$, -0.01, tests.id('team_t')),
  '23514', null, 'AC-2 admin_t: -0.01 is refused (23514)');
select throws_ok(
  format($$update public.team set overload_threshold = %L where id = %L$$, 2, tests.id('team_t')),
  '23514', null, 'AC-2 admin_t: 2 is refused (23514)');
select throws_ok(
  format($$update public.team set overload_threshold = %L where id = %L$$, 'NaN', tests.id('team_t')),
  '23514', null, 'AC-2 admin_t: NaN is refused (23514)');

select results_eq(
  $$select overload_threshold from public.team where id = tests.id('team_t')$$,
  $$values (0.5::numeric)$$,
  'AC-2: team_t''s threshold is unchanged after the four refusals'
);

-- AC-3: the bounds themselves, and 0.5, are accepted — each affects exactly one row and is stored.
select is(
  tests.rows_affected($$update public.team set overload_threshold = 0 where id = tests.id('team_t')$$),
  1::bigint, 'AC-3 admin_t: 0 affects one row');
select results_eq(
  $$select overload_threshold from public.team where id = tests.id('team_t')$$,
  $$values (0::numeric)$$,
  'AC-3: team_t''s threshold is stored at 0'
);

select is(
  tests.rows_affected($$update public.team set overload_threshold = 1 where id = tests.id('team_t')$$),
  1::bigint, 'AC-3 admin_t: 1 affects one row');
select results_eq(
  $$select overload_threshold from public.team where id = tests.id('team_t')$$,
  $$values (1::numeric)$$,
  'AC-3: team_t''s threshold is stored at 1'
);

select is(
  tests.rows_affected($$update public.team set overload_threshold = 0.5 where id = tests.id('team_t')$$),
  1::bigint, 'AC-3 admin_t: 0.5 affects one row');
select results_eq(
  $$select overload_threshold from public.team where id = tests.id('team_t')$$,
  $$values (0.5::numeric)$$,
  'AC-3: team_t''s threshold is stored at 0.5'
);

select * from finish();
rollback;
