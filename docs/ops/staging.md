# Staging — a second CaleChip in the `mmlabs-online` organisation

A staging copy of CaleChip that runs beside production on the same home server and **cannot reach
production**: not its Supabase project, not its Docker Hub tags, not its deployment folder, not its
tunnel hostname. Written 2026-11-10 at the operator's request. [ci-cd.md](ci-cd.md) is still the
pipeline; this page lists only what staging changes.

**Production is untouched by everything below.** The workflows read three Actions variables and fall
back to the production values when they are unset, and the production repository sets none of them.

## What is separate

| | Production (`didi-code0980/calechip`) | Staging (`mmlabs-online/calechip`) |
|---|---|---|
| Supabase project | the production project | **a new, separate project** |
| Image | `mingming21400/calechip` | `mingming21400/calechip-staging` |
| GitHub environment | `prod` | `staging` |
| Deployment folder | `apps/calechip/` | `apps/calechip-staging/` |
| Release branch in the deployment repo | `release/calechip-vX.Y.Z` | `release/calechip-staging-vX.Y.Z` |
| Deploy workflow | `deploy-calechip` | `deploy-calechip-staging` |
| Compose project / service | `calechip` / `calechip` | `calechip-staging` / `calechip-staging` |
| Tunnel target | `http://calechip:3000` | `http://calechip-staging:3000` |

**The guard.** In any repository other than `didi-code0980/calechip`, `build-image` refuses to run
while `IMAGE_NAME` is unset or names the production image, and `release` refuses while `IMAGE_NAME`
or `DEPLOY_FILE` points at production. A clone with no variables set fails closed.

## Steps, in order

1. **Create the empty repository** `mmlabs-online/calechip`, private, with no README.
2. **Push the code — `main` only, no tags.** Pushing every tag would start one `release` run per
   tag; the guard stops each, but there is no reason to start them. From a checkout that holds this
   page (the guard ships with it):

   ```
   git push https://github.com/mmlabs-online/calechip.git origin/main:refs/heads/main
   ```

3. **Create the staging Supabase project.** Apply `supabase/migrations/` in order, then
   `supabase/seed.sql`, by hand (ADR-024 — the pipeline applies no migration). Under
   Authentication → URL configuration, set the site URL and redirect URLs to the staging hostname.
   **Never point staging at the production project:** the anon key plus row-level security is the
   whole authorization model, and staging writes would be real writes.
4. **Create the Docker Hub repository** `mingming21400/calechip-staging`.
5. **In `mmlabs-online/calechip` → Settings → Environments**, create `staging`.
6. **Actions secrets** (Settings → Secrets and variables → Actions):
   - `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` — a token scoped to `calechip-staging` if Docker Hub
     allows it.
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — **the staging project's**.
   - `DEPLOY_REPO_TOKEN` — fine-grained, on the deployment repository only.
7. **Actions variables:**
   - `IMAGE_NAME` = `mingming21400/calechip-staging`
   - `DEPLOY_FILE` = `apps/calechip-staging/release.env`
   - `DEPLOY_ENVIRONMENT` = `staging`
   - `DEPLOY_REPO` = the deployment repository, `owner/name`
8. **In the deployment repository**, add from
   [deployment-repo/](deployment-repo/): `apps/calechip-staging/compose.yml` (replace
   `TODO-operator-tunnel-network` with the same network production uses),
   `.github/workflows/deploy-calechip-staging.yml`, and the `CODEOWNERS` line for
   `/apps/calechip-staging/`. `pr-scope` already covers the new folder.
9. **Cloudflare Tunnel:** add a public hostname for staging pointing at
   `http://calechip-staging:3000`. Do not change the production hostname.
10. **Build and release.** `build-image` runs on push to `release/**` (the temporary trigger noted in
    its header). Push a branch there, then tag its commit on `main` with a pre-release such as
    `v0.0.0-rc.1`. Merging the `release/calechip-staging-…` pull request in the deployment repository
    deploys staging.

## Check it is isolated

- The `build-image` run summary names `mingming21400/calechip-staging:sha-<7>`.
- The deployment pull request changes only `apps/calechip-staging/release.env`.
- `docker compose -p calechip ps` on the server shows the production container unchanged.
- The staging site's `seam-banner` and network tab show the staging Supabase URL.
