# Changelog

All notable changes to Forward Deploy. Format follows Keep a Changelog; versioning is semver.
Forward Deploy is pre-1.0.

## [Unreleased]

### Added
- **Slack capture bot** - DM the Forward Deploy bot a note, idea, or process brain-dump and it
  lands in your in-app Captures inbox (messages within 30 minutes group into one capture).
  Access is roster-gated app-side: the sender's Slack email must match an invited user; others
  get a polite decline and nothing is stored. Signed-request verification, retry dedupe, and
  the whole feature is dormant without `SLACK_BOT_TOKEN`/`SLACK_SIGNING_SECRET`. The Captures
  page turns any capture into an SOP with one click - the builder opens pre-loaded with what
  you wrote in Slack. Dashboard nudge + sidebar entry.

### Added
- **Bitbucket Cloud provider** - promoted from post-v1 into v1 (the reference deployment's repo
  lives on Bitbucket). A second `SourceControlProvider` implementation over the 2.0 REST API
  (plain fetch, no SDK): list/read/exists via `/src`, commits via `POST /src`, workspace code
  search with graceful degrade when it isn't enabled. Selected with `SOURCE_PROVIDER=bitbucket`;
  auth = `BITBUCKET_EMAIL` + `BITBUCKET_API_TOKEN` (Atlassian API token), `REPO_OWNER` = the
  workspace. Health check reports per-provider config. Kickoff detects the provider from the
  git remote.

## [0.4.0] - 2026-07-15

### Added
- **The dev review loop (Phase 4)** - submitted plans land in a filterable queue on /plans; the
  plan page grows a manager <-> developer review thread and (for developers/admins) validated
  status controls over the full workflow `submitted -> in_review -> changes_requested / approved
  -> in_development -> shipped` (+ `declined`, with re-open). Managers submit and converse; only
  the dev team advances status.
- **The plans API** - token-authed REST (Bearer `FORWARD_DEPLOY_TOKEN`, timing-safe compare) that
  `/forward-deploy:review-plans` and `:pull-plan` consume: list the queue, fetch a full plan
  (sections, citations, mockup HTML, thread), post thread replies (attributed via `authorEmail`
  when it matches an invited user, else a "Dev team (Claude Code)" system user), and make
  validated status transitions. **This completes the v1 core loop end-to-end** - manager's idea
  to developer's editor; what remains for v1 is the live-deploy shakedown (SPEC section 4).

### Added (0.3.x line)
- **Software canons + `/forward-deploy:capture-software`** (fifth gate) - one canon per vendor
  product the company uses, at `docs/software/<slug>.md` with an `INDEX.md` breadth map (the same
  folder-plus-index convention as department SOPs). The skill researches the vendor's public
  developer docs from Claude Code - API surface, webhooks, auth model, tier/rate limits, docs
  links - harvests candidates from the SOP `tools:` lists, and commits after human review. The
  plan builder loads the index in its cached breadth block, reads a named product's canon before
  assessing integration feasibility, and when a manager names undocumented software it records
  the gap in open_questions and points the dev team at this gate. New env: `SOFTWARE_DOCS_PATH`
  (default `docs/software`).

## [0.3.0] - 2026-07-15

### Added
- **The plan builder (Phase 3)** - the heart of Forward Deploy. A manager starts a plan for their
  department and works with Claude exactly like Claude Code's plan mode: Claude interviews,
  actively explores the connected repo mid-conversation (list/read/search tools in an agentic
  loop), grounds feasibility claims in canons and code, checks other departments' SOP indexes for
  the same pain or tools, and fills the structured plan document (per `templates/plan-guidelines.md`)
  incrementally via an `update_plan` tool while the manager watches it grow. `create_mockup`
  attaches brand-token-styled, self-contained HTML mockups, rendered in sandboxed iframes on the
  plan page. Context is cache-ordered: identity -> the breadth block (CANONIFY.md + every
  department's SOP INDEX + the company profile, cache-marked) -> the live plan state, last and
  uncached, rebuilt every turn. Required sections gate draft -> submitted; every turn's chat is
  appended to `plan_sessions` for auditability. Plans list/new/view/build pages, status chips,
  and the submit flow round it out.

### Added (0.2.x line)
- **Per-department `INDEX.md`** - every SOP commit regenerates
  `docs/sops/<department>/INDEX.md` with one summary line per SOP (topic, tools, the "What this
  covers" first paragraph). It is the Canonify-style breadth map: developers scan it in the repo,
  and the Phase 3 plan builder routes through it instead of loading every SOP in full.

## [0.2.0] - 2026-07-15

### Added
- **The SOP builder (Phase 2)** - managers document their department one process at a time, with
  as many SOPs per department as they need. A two-column drafting surface (the Document-with-Craig
  pattern): chat with Claude on the left, the editable markdown draft on the right. One Claude turn
  = the Messages API with an `update_sop_draft` tool on `tool_choice: auto` - Claude interviews
  while gathering, then returns the complete regenerated document; "Apply to editor" replaces the
  draft. System blocks are ordered for prompt caching (identity/rules -> the existing-SOP corpus,
  cache-marked -> the live current draft, last + uncached, resent every turn). Author and revise
  modes; "Commit to repo" writes `docs/sops/<department>/<topic>.md` to your source control with
  an attributed commit message. SOP browse/view pages render straight from the repo. Degrades
  gracefully when no Anthropic key is configured.

## [0.1.0] - 2026-07-14

### Added
- **Repo + plugin packaging** - `.claude-plugin/{plugin,marketplace}.json`, so
  `/plugin marketplace add ewebdzine/forward-deploy` works from day one.
- **Four skill gates** (initial versions) - `/forward-deploy:kickoff` (wizard: collect keys,
  configure, deploy the app to Vercel), `/forward-deploy:review-plans` (list submitted plans, read
  one, reply in its thread), `/forward-deploy:pull-plan` (fetch an approved plan into Claude Code as
  the implementation brief), `/forward-deploy:doctor` (health-check keys, app, and repo paths -
  reports a worklist, does not auto-fix).
- **Templates** - `templates/plan-guidelines.md` (the structured plan outline Claude follows in the
  plan builder), `templates/sop-template.md` (department SOP skeleton), and
  `templates/company-profile.md` (branding + product-docs skeleton the mockup generator reads).
- **The app scaffold** (`app/`) - Next.js (App Router, TypeScript) + Drizzle/Postgres + Auth.js
  magic-link with roles (admin / developer / manager), admin UI for departments + invites, and a
  read-only GitHub repo/canon browser proving source-control connectivity. Configuration is 100%
  env vars - Anthropic, Postgres, SMTP, GitHub - never a paid service of ours.
