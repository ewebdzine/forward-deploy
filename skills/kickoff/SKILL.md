---
name: kickoff
description: One-time onboarding wizard that stands up a company's Forward Deploy instance - verify Canonify, collect the BYO keys (Anthropic / Postgres / SMTP / GitHub), configure, walk the Vercel deploy, create the admin + departments, and write forward-deploy.json so the other gates can find the app. Run when the user types /forward-deploy:kickoff, or says "set up Forward Deploy", "deploy the planning app", "stand up forward deploy", "onboard forward deploy here", "install the forward deploy app".
---

# Kickoff - deploy your company's Forward Deploy instance

The onboarding gate. Run it ONCE per company repo to stand up the Forward Deploy app: keys
collected, app deployed (Vercel by default), admin + departments created, and a committed
`forward-deploy.json` at the repo root so `/forward-deploy:review-plans`, `:pull-plan`, and
`:doctor` know where the instance lives. It is an interactive wizard, not a silent deployer.

> Vocabulary: the **app** is the open-source Next.js project that ships in this plugin's repo
> (`app/`); an **instance** is one company's deployment of it; `forward-deploy.json` is the
> committed, non-secret pointer to the instance. Secrets NEVER go in it - they live in the
> deployment's env vars and the developer's local `.env`.

## How to run

1. **Detect.**
   - Confirm this is a git repo and read the remote to detect the provider: GitHub or Bitbucket
     (both supported; `SOURCE_PROVIDER` in the app env selects the implementation).
   - **Already set up?** If `forward-deploy.json` exists at the repo root, do NOT re-run the
     wizard - report the instance URL and offer to *reconfigure* (rotate keys, change paths,
     redeploy) instead.
   - **Canonify present?** Look for `CANONIFY.md`. If absent, recommend running
     `/canonify:kickoff` first - plans are far sharper with canons - but do not block; Forward
     Deploy runs on the raw code alone.

2. **Survey** (collect what a deploy needs; never echo a secret back to the screen):
   - **Anthropic API key** (`ANTHROPIC_API_KEY`) - powers the SOP/plan chats.
   - **Postgres** (`DATABASE_URL`) - offer Neon/Vercel Postgres free tier if they have nothing.
   - **SMTP** (`EMAIL_SERVER_*`, `EMAIL_FROM`) - magic-link login; suggest Resend/Brevo free tier.
   - **Source-control credentials** - GitHub: `GITHUB_TOKEN` (repo read + contents write).
     Bitbucket: `BITBUCKET_EMAIL` + `BITBUCKET_API_TOKEN` (Atlassian API token, repository
     read + write) and `SOURCE_PROVIDER=bitbucket`. Confirm `REPO_OWNER`/`REPO_NAME`/
     `REPO_BRANCH` from the git remote rather than asking (Bitbucket: owner = workspace).
   - **Paths** - SOPs (`SOP_PATH`, default `docs/sops`) and company docs (`COMPANY_DOCS_PATH`,
     default `docs/company`).
   - **Admin email** - the first login; and the first department names/managers if they have them.
   - **Deploy target** - Vercel (walk it below) or self-host/extranet (point at `app/README.md`
     and stop after config).

3. **Act.**
   - Generate `AUTH_SECRET` and `FORWARD_DEPLOY_TOKEN` (the skills' API token) locally
     (`openssl rand -base64 32`).
   - **Vercel path:** use the `vercel` CLI if present (`vercel link`, `vercel env add` per var,
     `vercel deploy --prod`); otherwise print the exact dashboard steps (import the repo, set the
     `app/` root directory, paste the env vars). Never store secrets anywhere but Vercel env and
     the local `.env`.
   - Run the DB migration step the app documents (`app/README.md`).
   - Seed via the app's setup endpoint or seed script: the admin user, the first departments.
   - Write **`forward-deploy.json`** at the repo root - non-secret only:
     `{ "appUrl": "...", "sopPath": "docs/sops", "companyDocsPath": "docs/company", "provider": "github", "repo": "<owner>/<name>" }`.
   - Ensure `docs/sops/` and `docs/company/` exist in the repo (seed `docs/company/` from
     `${CLAUDE_PLUGIN_ROOT}/templates/company-profile.md` so mockups have branding to read).
   - Add `FORWARD_DEPLOY_TOKEN` to the developer's local `.env` (gitignored) and to the deployment.

4. **Verify.** Hit `<appUrl>/api/health` - it must report db + repo + anthropic reachable. If not,
   hand off to `/forward-deploy:doctor` style diagnostics before declaring success.

5. **Report.** The instance URL, what was created (env vars set - names only, `forward-deploy.json`,
   seeded departments), and next steps: admin invites managers in the app, managers write SOPs,
   `/forward-deploy:review-plans` when the first plan lands.

## Don't do

- **Don't re-run on a configured repo.** Detect `forward-deploy.json` and offer reconfigure.
- **Don't put secrets in `forward-deploy.json`, the repo, or the chat transcript.** Env vars only;
  refer to keys by name once collected.
- **Don't deploy silently.** Show each step (or each CLI command) before running it.
- **Don't block on Canonify.** Recommend it, then proceed either way.

## Output template

```
FORWARD DEPLOY KICKOFF - <deployed | configured (self-host) | reconfigured>

Instance:   <appUrl>
Repo:       <owner>/<name> (<branch>)   SOPs: <sopPath>   Company docs: <companyDocsPath>
Env vars:   ANTHROPIC_API_KEY, DATABASE_URL, EMAIL_SERVER_*, EMAIL_FROM, GITHUB_TOKEN,
            AUTH_SECRET, FORWARD_DEPLOY_TOKEN  (set on <target>; values not shown)
Seeded:     admin <email>, departments: <list>
Health:     /api/health -> <ok | findings>

Next: invite managers (Admin > Users), have each write their first SOP, then watch
/forward-deploy:review-plans for the first submitted plan.
```
