# Changelog

All notable changes to Forward Deploy. Format follows Keep a Changelog; versioning is semver.
Forward Deploy is pre-1.0.

## [Unreleased]

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
