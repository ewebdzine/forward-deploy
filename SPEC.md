# Forward Deploy - SPEC (feature checklist + release definition-of-done)

The rubric Forward Deploy is checked against on the way to v1. Update status as pieces land.
Status legend: **Done** / **Partial** / **Planned**.

> Context: Forward Deploy is the sibling of [Canonify](https://github.com/ewebdzine/canonify) -
> same open-source playbook (a GitHub repo that is a plugin marketplace, MIT, BYO keys), but where
> Canonify gives an AI assistant a memory of how the codebase does things, Forward Deploy gives
> department managers a planning tool with that same context. The full design rationale lives in
> the plan that seeded this repo; this spec is what "complete v1" means.

---

## 1. Feature checklist (what "complete v1" is)

### The plugin (skills/)

| Capability | What it is | Status |
|---|---|---|
| **Kickoff gate** | `/forward-deploy:kickoff` - wizard: verify Canonify (recommend if absent), collect keys (Anthropic / Postgres / SMTP / GitHub), configure, walk the Vercel deploy, create admin + departments, print manager onboarding steps. Detects an already-configured install and offers reconfigure | Partial - skill written; end-to-end walk untested until the app ships |
| **Review-plans gate** | `/forward-deploy:review-plans` - list submitted plans via the app's token-authed API, read one, reply in its thread | Partial - skill written; blocked on the Phase 4 plans API |
| **Pull-plan gate** | `/forward-deploy:pull-plan` - fetch an approved plan (sections, mockup HTML, cited files/canons) into Claude Code as the implementation brief; pairs with `/canonify:build` | Partial - skill written; blocked on the Phase 4 plans API |
| **Doctor gate** | `/forward-deploy:doctor` - keys valid (Anthropic ping, GitHub scopes, DB reachable), app URL healthy, SOP/company-doc paths exist; worklist, never auto-fix | Partial - skill written; app health endpoint lands in Phase 1 |

### The app (app/)

| Capability | What it is | Status |
|---|---|---|
| **Foundation** | Next.js App Router + TypeScript; Drizzle/Postgres; 100%-env-var config; `/api/health` | Planned (Phase 1) |
| **Auth + roles** | Auth.js magic-link (SMTP), invited-users-only, roles admin / developer / manager | Planned (Phase 1) |
| **Admin UI** | create departments, invite users with role + department assignment | Planned (Phase 1) |
| **Source-control provider** | `SourceControlProvider` interface; GitHub (Octokit) impl: list/read/search; read-only repo + canon browser proves connectivity | Planned (Phase 1) |
| **SOP builder** | guided chat -> markdown committed to `docs/sops/<department>/` via the GitHub API; in-app SOP browser reads live from the repo | Planned (Phase 2) |
| **Plan builder** | the heart: Anthropic Messages API tool loop (streaming) with repo/canon/SOP/company-profile tools; plan-mode-style interview; structured sections per `templates/plan-guidelines.md`; draft -> submit | Planned (Phase 3) |
| **Mockups** | `create_mockup` tool -> self-contained HTML styled from company-profile branding tokens; sandboxed `iframe srcdoc` rendering; attached to the plan | Planned (Phase 3) |
| **Dev review loop** | plan queue; status workflow `draft -> submitted -> in_review -> changes_requested / approved -> in_development -> shipped` (+ `declined`); manager <-> developer thread per plan | Planned (Phase 4) |
| **Plans API** | token-authed REST endpoints the review-plans / pull-plan skills consume | Planned (Phase 4) |
| **Plan sessions** | the Claude transcript that produced each plan, stored for auditability | Planned (Phase 3) |

### Conventions (templates/)

| Capability | What it is | Status |
|---|---|---|
| **Plan guidelines** | the structured outline every plan follows: Problem / Current process & inefficiency / Proposed solution / Affected systems & existing patterns (cited to canons + files) / Mockups / Open questions / Rough scope signal | Done (initial) |
| **SOP template** | department SOP skeleton: software used, process, hand-offs, pain points | Done (initial) |
| **Company profile** | branding tokens + screenshots + product docs skeleton the mockup generator reads | Done (initial) |

## 2. OSS-readiness checklist (what GitHub needs)

| Item | Status |
|---|---|
| `README.md` (pitch + quickstart) | Done (initial) |
| `LICENSE` (MIT) | Done |
| `CHANGELOG.md` + semver | Started |
| `CONTRIBUTING.md` | Planned |
| Plugin packaging: `.claude-plugin/{plugin,marketplace}.json` | Done |
| `app/README.md` - standalone deploy docs (Vercel button, self-host/extranet) | Planned (Phase 1) |
| `.env.example` documenting the full env-var contract | Planned (Phase 1) |
| Quickstart that takes a cold repo to a deployed app in < 30 min | Planned (Phase 4 exit test) |
| README SVG diagrams (assets/) | Planned |

## 3. Post-v1 (explicitly out of v1)

| Capability | Notes |
|---|---|
| **Cross-department insights** | scheduled Claude sweep over all SOPs writing `insights` records - the "every department has its own Zoom account" flag |
| **Bitbucket provider** | second `SourceControlProvider` implementation |
| **Extranet hardening** | Dockerfile + docs for embedding in an existing intranet/extranet without Vercel |
| **Screenshot upload** | in-app upload into the company profile (v1: commit screenshots to `docs/company/` by hand) |
| **Plan export** | approved plan -> GitHub issue(s) |

## 4. Confidence - how we know it works (v1 definition-of-done)

Run against a real repo that already has canons (ceosite or canonify itself as the guinea pig):

1. Plugin installs from the GitHub marketplace into a scratch repo; every skill triggers by name
   and by its trigger phrases; kickoff detects an already-configured install.
2. Magic-link login round-trips on a real Vercel deploy (real SMTP).
3. An SOP authored in the app appears as a commit in the repo at `docs/sops/<department>/`.
4. A plan built by a test "manager" cites real files/canons, renders its mockup in the sandbox,
   and shows up in the dev queue; a developer reply posts to the thread; the status workflow
   advances end-to-end.
5. `/forward-deploy:pull-plan` retrieves that plan in Claude Code; `/forward-deploy:doctor`
   reports clean.
6. The whole path - cold repo to deployed app - fits in 30 minutes following only the README.
