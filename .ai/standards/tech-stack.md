---
doc_version: 1
last_updated: 2026-08-31
governed_by: [RULE-02, RULE-09]
---

# Tech stack

**The single place that answers "what are we building with".** Every other document in this
repository cites this file rather than restating it. If a language, framework, datastore, runner or
package manager is named twice in this repository, one of the two copies is wrong and this one is
the original.

## What this file holds, and what it must never hold

It holds **choices and majors**. It does not hold resolved versions, and it does not hold the
reasoning that belongs to a decision record.

| Fact | Lives here? | Where it actually lives |
|---|---|---|
| Language, framework, datastore, runners, package manager — the choice and the major | **yes** | this file |
| The exact resolved version of anything installed | no | `package.json` and the lockfile |
| The data-access seam: its path, its lint rule, its implementations | no | [architecture.md](architecture.md) |
| Layers, and where authorization lives | no | [architecture.md](architecture.md) |
| The four commands, by role | no | [testing-standards.md](testing-standards.md) |
| Field names and schema | no | [data-model.md](data-model.md) |
| External services, and what happens when one is unreachable | no | [integrations.md](integrations.md) |
| A package that must not enter the dependency tree | no | [boundaries.json](../registry/boundaries.json) |
| Why a choice below was made over the alternative | no | `.ai/registry/decisions/` |

**Resolved versions are deliberately excluded.** A document that restates the lockfile is wrong
within a week of the first patch bump, and a stale version string is worse than an absent one because
an agent reads it as current. Name the major that was chosen — `19`, `8`, `4` — and let the manifest
carry the rest.

## Where these choices came from

The interface stack was **not chosen from scratch**. It is the stack the Figma Make prototype in
`_figma/` was generated on, adopted deliberately so the reference and the implementation do not drift
apart in tooling. Everything below the interface — datastore, runners, linter — was decided
separately, on 2026-08-31.

`_figma/` is a reference, not source. It is named in `SOURCE_ROOTS` so `ba` and `qa` cannot read it,
for the same reason they cannot read the implementation: a test derived from a prototype agrees with
the prototype rather than with the story.

## Runtime and language

| | Choice | Major |
|---|---|---|
| Runtime | Node.js | 22 |
| Language | TypeScript | 5 |
| Package manager | pnpm | 10 |

Toolchain versions are pinned in `_figma/.mise.toml` and mirrored by `packageManager` in
`package.json`. TypeScript runs in `strict` mode with `"@/*"` aliased to the source root — the
configuration the prototype already uses, carried forward rather than re-derived.

## Framework

| | Choice | Major |
|---|---|---|
| Interface | React | 19 |
| Routing | react-router-dom | 7 |
| Build tool | Vite | 8 |
| React plugin | `@vitejs/plugin-react` | 6 |
| Styling | Tailwind CSS | 4 |

**Tailwind 4 takes no config file and no PostCSS config.** It is wired through the
`@tailwindcss/vite` plugin, and theme customisation goes in the global CSS entry point next to
`@import 'tailwindcss';`. This is a real change from Tailwind 3 and is the single most likely thing
to be written wrongly from memory — see *Versions the model cannot recall* below.

Supporting libraries, all carried from the prototype: `date-fns` 4 (with the `vi` locale),
`lucide-react` 1, `clsx` 2, `tailwind-merge` 3.

## Datastore

| | Choice | Major |
|---|---|---|
| Datastore | Supabase (PostgreSQL) | TODO(verify) |
| Client | `@supabase/supabase-js` | TODO(verify) |
| Migrations | Supabase CLI migrations | TODO(verify) |

**Everything that reaches this datastore lives inside the seam**, which is declared in
[architecture.md](architecture.md), not here. This section names the product; that file names the
one door to it. Recording the client library here and the seam there is the split that keeps RULE-02
checkable — R4 points at a directory, not at a package name.

**Supabase brings a second permission layer, and that is a decision, not a detail.**
[architecture.md](architecture.md) states that two layers enforcing permissions is a drift source:
they agree until they do not, and the disagreement is invisible until a role is added. Row-level
security and the seam are exactly two such layers. Which one is authoritative must be settled in an
ADR with a revert condition before the first ticket that touches permissions.

TODO(project): write that ADR. Until it exists, design section 2 has no single answer to point at and
review check R6 is comparing an implementation against an undecided model.

## Interface between the parts

TODO(project): the shape of the call from the interface into the seam, and whether any server-side
code exists beyond what Supabase provides. The prototype is client-only with data held in component
state, so this has no prior art in `_figma/` and must be decided rather than copied.

## Test runners

| | Choice | Major |
|---|---|---|
| Unit and component | Vitest | TODO(verify) |
| End-to-end | Playwright | TODO(verify) |

Vitest was chosen because it reuses the Vite configuration this project already has, so the unit
level costs almost no configuration. Playwright covers the end-to-end level that the Definition of
Done requires.

**The commands are not here.** [testing-standards.md](testing-standards.md) holds the
role-to-command table, because the Definition of Done and checks R2 and R3 refer to those commands by
role, and one file has to know their names. This section names the tools; that file names the
invocations.

## Lint and formatting

| | Choice | Major |
|---|---|---|
| Linter | ESLint | 9 |
| Import boundaries | `import/no-restricted-paths` or `eslint-plugin-boundaries` | TODO(verify) |
| Formatter | oxfmt | 0.2 |

ESLint was chosen over the faster alternatives for one reason: **it is the mechanism behind RULE-02**,
and a linter that cannot express "nothing outside this directory may import the datastore client"
leaves that rule as a sentence. Speed was the wrong thing to optimise for on the one rule the whole
architecture hangs from.

oxfmt stays as the formatter, carried from the prototype. It formats; it does not lint, and it is not
load-bearing for any rule.

TODO(project): once the seam directory exists, configure the boundary rule, then record it in the
enforcement map in [rules.md](../registry/rules.md) — that table is claiming something untrue until
the rule is real.

## Build and deployment

TODO(project): the deployment target for a Vite single-page build, and the build output directory,
which must also be added to `.gitignore`. Not decided on 2026-08-31 and deliberately left open — it
constrains nothing upstream of it.

## Versions the model cannot recall

**Any dependency whose current release is newer than the model's training data must be inspected
before configuration is written against it** — the installed types, the package's own documentation,
the real config file on disk. `TODO(verify):` is the correct output when a fact cannot be confirmed;
a confident guess is not.

This paragraph is not boilerplate. In the project this kit came from, a framework major had moved
connection configuration between two files and inverted which one wanted which URL. Written from
memory, it produced migrations that failed intermittently rather than cleanly — the failure mode that
costs the most to diagnose, because it looks like a data problem.

**Open the real file before writing config against any of these:**

| Dependency | Why it is on this list |
|---|---|
| Vite 8 | Major is past reliable recall; plugin and config surface may have moved |
| Tailwind CSS 4 | Config-file-less, CSS-first. Writing a `tailwind.config.js` here is the classic Tailwind 3 reflex and produces a file nothing reads |
| react-router-dom 7 | Past recall; the routing API has changed shape across recent majors |
| `@vitejs/plugin-react` 6 | Past recall, and coupled to the Vite major |
| `lucide-react` 1 | Left `0.x` versioning; import surface unconfirmed |
| oxfmt | Young tool, unconfirmed CLI surface |
| ESLint 9 and the boundary plugin | Flat config is required at 9; the plugin's own config shape is unconfirmed |
| Vitest, Playwright | Majors unconfirmed, and both are coupled to the Vite major |
| `@supabase/supabase-js`, Supabase CLI | Major unconfirmed; auth and client initialisation are the parts most likely to have moved |

The authoritative source for each is `_figma/pnpm-lock.yaml` for what the prototype resolved, and the
installed `node_modules` types once dependencies exist here.

## Changing anything on this page

Two mechanisms, and neither is optional:

1. **An ADR** in `.ai/registry/decisions/`. Review check R9 fails a dependency added without one.
   Swapping a datastore, a framework major, or a test runner is the same kind of change as adding a
   package and takes the same record.
2. **An entry in [boundaries.json](../registry/boundaries.json)** if the ADR names a revert condition
   of the form *this package must not enter the tree*, or *it may only be reachable from this
   directory*. Check D12 then enforces it, instead of a reviewer having to remember what the ADR
   said.

This file is standards plane: human-owned, and covered by CODEOWNERS review on the pull request.
An agent that needs a change here stops with `gate: BLOCKED` and states the change in
`blocking_reason`.
