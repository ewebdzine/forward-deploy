---
name: doctor
description: Health-check a Forward Deploy install - instance reachable and its /api/health green (db, repo, anthropic), local skill config present (forward-deploy.json + FORWARD_DEPLOY_TOKEN), SOP/company-doc paths intact in the repo, and best-effort plugin-freshness against the GitHub source. Reports a worklist; does not auto-fix. Run when the user types /forward-deploy:doctor, or says "is forward deploy healthy", "check the forward deploy install", "why can't the app read the repo", "forward deploy health check", "is the planning app up".
---

# Doctor - keep the install honest

The health gate. It checks the four legs a working Forward Deploy instance stands on - the app,
its keys, the repo paths, and the local skill config - and reports a worklist; it does not
auto-fix. Run it manually when something feels off, after rotating keys, or on a schedule.

> The **instance** is the company's deployment of the app; `forward-deploy.json` (repo root,
> committed, non-secret) points the skills at it; `FORWARD_DEPLOY_TOKEN` (env) authenticates them.

## How to run

1. **Check 1 - local skill config.**
   - `forward-deploy.json` exists at the repo root and parses; `appUrl`, `repo`, `sopPath`,
     `companyDocsPath` present. Its `repo` matches the git remote (flag mismatch).
   - `FORWARD_DEPLOY_TOKEN` is set in the environment / local `.env`. Never print it.

2. **Check 2 - instance health.** `GET <appUrl>/api/health` (no auth) - expect per-dependency
   status: **db** (Postgres reachable, migrations current), **repo** (GitHub token valid, scopes
   sufficient, configured repo/branch readable), **anthropic** (key valid), **email** (SMTP config
   present - config-level only; do not send a test mail unless asked). Then one authed call
   (`GET /api/plans?limit=1`) to prove `FORWARD_DEPLOY_TOKEN` is accepted - 401 means the local
   token and the instance's have drifted.

3. **Check 3 - repo paths.** In the repo (at the configured branch): `sopPath` and
   `companyDocsPath` exist; the company profile doc is present (mockups read it - flag if it is
   still the untouched template: branding tokens unset means generic mockups); if `CANONIFY.md`
   exists, note canons available; if not, note plans run on raw code only.

4. **Check 4 - plugin freshness (optional, best-effort).** Same procedure as Canonify's doctor:
   read `~/.claude/plugins/installed_plugins.json` for `forward-deploy@<marketplace>`; resolve the
   marketplace's git URL; compare the source's `.claude-plugin/plugin.json` `version` against the
   installed one. No install record (local dev checkout) or offline -> SKIP and say so. Flag only
   on a version difference; never run the update yourself.

5. **Open with a self-identifying banner, then report the worklist.** A scheduled sweep arrives
   with no context, so the FIRST line must name Forward Deploy and the verdict. Group findings by
   check, each with evidence and a one-line suggested action.

## Don't do

- **Don't auto-fix.** Report; the human decides (or runs kickoff's reconfigure path).
- **Don't print secrets** - token/env values never appear in output, only their names and whether
  they are set/accepted.
- **Don't declare healthy on a partial pass.** If a leg was skipped (offline, no token), say
  skipped - skipped is not green.
- **Don't send outward traffic beyond the checks** - no test emails, no posting to plan threads.

## Output template

```
FORWARD DEPLOY DOCTOR - <found <N> item(s) to review | clean, nothing to review>

Instance: <appUrl>   Repo: <owner>/<name>@<branch>

### Local config
- [OK|MISSING|MISMATCH] forward-deploy.json ...
- [OK|MISSING] FORWARD_DEPLOY_TOKEN set

### Instance health (/api/health)
- [OK|FAIL] db ...   - [OK|FAIL] repo (scopes) ...   - [OK|FAIL] anthropic ...   - [OK|WARN] email ...
- [OK|401] authed API call

### Repo paths
- [OK|MISSING] <sopPath>/ ...   - [OK|MISSING|TEMPLATE] <companyDocsPath>/company-profile.md
- [INFO] CANONIFY.md <present, N canons | absent - plans run on raw code>

### Plugin freshness
- [OK|BEHIND|N/A] forward-deploy@<marketplace> ...

### Summary
<N> checks run, <F> findings, <S> skipped. <Clean | Address the above>.
```
