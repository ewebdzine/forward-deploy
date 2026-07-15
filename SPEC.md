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
| **SOP builder** | the "Document with Craig" pattern (ceosite `docs/services/document-with-craig.md`), retargeted at markdown: a two-column surface (chat left, editable SOP draft right); one Claude turn = `tool_choice: auto` with an `update_sop_draft(title, markdown)` tool, so Claude chats while gathering and returns a COMPLETE regenerated draft when ready; system blocks ordered for prompt caching (identity/rules uncached -> SOP corpus cache-marked -> current draft LAST + uncached, sent live every turn; history is chat text only, never tool calls); revise mode when an existing SOP is opened; draft structure enforced by `templates/sop-template.md` (frontmatter + sections) in the prompt; save = commit to `docs/sops/<department>/` via the GitHub API; in-app SOP browser reads live from the repo; degrades gracefully with no Anthropic key | Done (initial) - `app/src/app/sops/`, `app/src/app/api/sop-chat/`, `app/src/lib/sops.ts`; multiple SOPs per department by design (one per process); every commit regenerates the department's `INDEX.md` (one summary line per SOP - the Canonify-style breadth map the plan builder and Claude Code gates route through); needs a live-deploy shakedown |
| **Plan builder** | the heart: Anthropic Messages API agentic tool loop (list_repo_files / read_repo_file / search_code / update_plan / create_mockup, tool_choice auto, capped rounds); plan-mode-style interview; cache-ordered context (identity -> breadth block: CANONIFY.md + all SOP indexes + company profile, cache-marked -> live plan state last/uncached); structured sections per `templates/plan-guidelines.md` with required-section gate on submit; draft -> submitted | Done (initial) - `app/src/app/plans/`, `app/src/app/api/plan-chat/`, `app/src/lib/plan-{context,sections}.ts`; non-streaming v1; needs a live-deploy shakedown |
| **Mockups** | `create_mockup` tool -> self-contained HTML styled from company-profile branding tokens; sandboxed `iframe srcdoc` (allow-scripts, no same-origin) rendering on the plan page | Done (initial) |
| **Dev review loop** | plan queue; status workflow `draft -> submitted -> in_review -> changes_requested / approved -> in_development -> shipped` (+ `declined`); manager <-> developer thread per plan | Planned (Phase 4) |
| **Plans API** | token-authed REST endpoints the review-plans / pull-plan skills consume | Planned (Phase 4) |
| **Plan sessions** | the Claude transcript that produced each plan, stored for auditability | Done (initial) - chat text per turn appended to `plan_sessions` |

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
| **Capture-schema gate** | `/forward-deploy:capture-schema` - dev-side sibling of capture-design: the developer runs it from Claude Code against their own databases; it introspects the schema (`information_schema` - tables, columns, types, relationships, a one-line purpose per table), and writes a sanitized data-model doc into `docs/company/` and/or Canonify canons, which the developer reviews before committing. **The app never connects to a company database** - Claude plans from the committed doc, so feasibility answers ("the data already exists in X") come from schema knowledge with zero data exposure. A guarded future option (separate, opt-in): live **curated views only** - a dedicated read-only Postgres role granted SELECT on hand-written, pre-aggregated, PII-free views, with statement timeout, row cap, and a per-plan-session query audit log. **Raw table access is a documented non-goal, even read-only** - plan output can leak whatever Claude reads, and prompts are not an access-control boundary |
| **Capture-design gate** | `/forward-deploy:capture-design` - a dev-side skill: the developer gives example URLs of sections of their app/site (logging in themselves via the browser when needed), Claude drives the browser (claude-in-chrome MCP / Playwright) to load each page and documents it - screenshot, layout skeleton, per-component HTML/CSS snippets, computed styles distilled into design tokens. Output routes two ways: (1) Canonify **design canons** via `/canonify:create-canon` (the existing mockup-recipe convention: a token-accurate static snippet per element), and (2) `docs/company/` - the company profile's brand tokens filled from reality + per-screen structure docs + screenshots. Payoff: the app's plan-builder mockups are generated from the ACTUAL production HTML/CSS structure, not guesses. Guardrails: credentials never captured or stored; only dev-chosen pages; flag screenshots containing real customer data before committing |
| **"Your developer" persona** | each department is assigned a developer from the dev team; that developer's name + profile photo front the department's planning surfaces ("planning with <Dev>" instead of a generic chat). The persona base (assigned developer + photo + text framing) is cheap and may land in v1 alongside Phase 4; the voice layer is post-v1 |
| **Developer voice replies (ElevenLabs, optional)** | when a manager submits a plan, the assigned developer's persona replies with a narrated summary/feasibility review in the developer's own cloned voice - the two-stage pipeline ceosite proves out (Claude rewrites the review as a spoken script in the developer's voice profile, then ElevenLabs TTS; canons `ceosite/docs/services/craig-voice-demo.md`, `craig-audio-tours.md`, `integrations/ai.md`). Strictly key-gated: `ELEVENLABS_API_KEY` + a per-developer voice id, recorded by the developer if they opt in; absent keys degrade to the photo + text persona with zero UI residue. Audio stored per-plan (portable storage - no Vercel-only blob APIs) |

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
