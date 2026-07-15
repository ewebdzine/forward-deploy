# Changelog

All notable changes to Forward Deploy. Format follows Keep a Changelog; versioning is semver.
Forward Deploy is pre-1.0.

## [Unreleased]

### Added
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
