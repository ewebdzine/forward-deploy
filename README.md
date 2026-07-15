# Forward Deploy

> Forward-deployed planning for every department - the developer's context, in the manager's hands.

Companies are embedding forward-deployed developers inside departments, where the developer works
directly with a manager to understand what the department actually does. **Forward Deploy** bets the
next step is **forward-deployed planning**: give every department manager a Claude-powered planning
tool that sees the same context a developer does - the codebase, the
[Canonify](https://github.com/ewebdzine/canonify) canons, the company's branding and product docs,
and the SOPs each department writes - so managers can document their department, describe
inefficiencies, and produce developer-ready plans (with HTML mockups) that route to the dev team
for review.

It is two things in one repo:

1. **A [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) plugin** - four skills
   that deploy the app, keep it healthy, and close the loop back into the developer's editor.
2. **An open-source web app** (`app/`) - Next.js, deployable to Vercel in minutes or pulled into
   your own extranet. **Bring your own keys** (Anthropic, Postgres, SMTP, GitHub); there is no
   hosted service and nothing to pay us.

## The problem

The people who best understand a department's inefficiencies - its managers - have no way to turn
that understanding into something a developer can build from. They file a ticket ("automate this
report") with none of the context that makes it buildable, and the developer starts cold. Meanwhile
the context that WOULD make it buildable already exists: the codebase, its canonical patterns, the
other departments' processes. Forward Deploy puts a planning tool on top of all of it.

## Concepts

- **An SOP** - one markdown doc a manager writes (guided by Claude) documenting a slice of their
  department: the software used, the process, the hand-offs, the pain points. Stored in **your
  repo** (`docs/sops/<department>/`), versioned next to your canons, visible to every developer.
- **A plan** - a structured, developer-ready proposal a manager builds in a plan-mode-style chat.
  Claude interviews the manager, explores the repo, cites the canons and files it would touch,
  generates brand-accurate HTML mockups, and fills a consistent outline
  (`templates/plan-guidelines.md`). Plans live in **your Postgres** with a status workflow and a
  manager <-> developer review thread.
- **The company profile** - branding tokens, screenshots, product docs (`docs/company/`) so mockups
  look like *your* software, not a generic wireframe.

## How the loop runs

1. **Deploy** - a developer runs `/forward-deploy:kickoff`: it collects your keys, configures the
   app, and walks the Vercel deploy. One admin account, departments created, managers invited
   (magic-link email login - no passwords to manage).
2. **Document** - each manager writes SOPs in a guided chat; Forward Deploy commits them to
   `docs/sops/<department>/` in your repo.
3. **Plan** - a manager opens "New plan" and works with Claude exactly like Claude Code's plan
   mode: clarifying questions, live exploration of the codebase/canons/SOPs, feasibility grounded
   in what actually exists, mockups, then a structured plan.
4. **Review** - the plan lands in the dev team's queue (`submitted -> in_review ->
   changes_requested / approved -> in_development -> shipped`), with the back-and-forth in a thread
   on the plan itself.
5. **Build** - the developer runs `/forward-deploy:pull-plan` to pull the approved plan into Claude
   Code as the implementation brief - it pairs naturally with `/canonify:build`.

The compounding unlock: once several departments have documented themselves, Claude plans with
cross-department sight. If three SOPs each mention their own Zoom account, a plan (or a later
insights sweep) can flag it: consolidate to a corporate account, integrate the API once, and pull
every department's meeting transcripts into one place.

## The skills

| Gate | Command | What it does |
|---|---|---|
| Kickoff | `/forward-deploy:kickoff` | wizard: collect keys -> configure -> deploy the app to Vercel -> create the admin + first departments |
| Review-plans | `/forward-deploy:review-plans` | list submitted plans from your instance, read one, reply in its thread |
| Pull-plan | `/forward-deploy:pull-plan` | fetch an approved plan (sections, mockups, cited files/canons) into Claude Code as the implementation brief |
| Doctor | `/forward-deploy:doctor` | health-check: keys valid, app reachable, repo/SOP paths intact - a worklist, never an auto-fix |

## Works best with Canonify

Forward Deploy reads `CANONIFY.md` and your canons when building plans, so proposals cite the
patterns your codebase already has instead of inventing parallel ones. It runs without Canonify -
plans still explore the raw code - but the canons are what make feasibility answers sharp. Set up
[Canonify](https://github.com/ewebdzine/canonify) first if you have not.

## Quickstart

```sh
# add this repo as a plugin marketplace
/plugin marketplace add ewebdzine/forward-deploy
/plugin install forward-deploy@forward-deploy

# deploy your company's instance (wizard)
/forward-deploy:kickoff
```

`kickoff` asks for your keys (Anthropic, Postgres, SMTP, GitHub) and walks the deploy. Prefer doing
it by hand, or embedding the app in an existing extranet? See [`app/README.md`](app/README.md) -
the app is a plain Next.js project with a 100%-env-var configuration contract.

## What it costs

Nothing to us, ever - MIT-licensed, self-hosted. You pay your own providers: Anthropic API usage
(the planning conversations), and whatever your Postgres/SMTP/hosting tiers cost (all have free
tiers that fit a small team: Vercel Hobby, Neon, Resend/Brevo).

## Status

Pre-0.5. The plugin packaging, skills, templates, and the app's foundation (auth, roles,
departments, GitHub connectivity) are in place; the SOP builder, plan builder, and review loop are
being built next. See [SPEC.md](SPEC.md) for the feature checklist and v1 definition-of-done, and
[CHANGELOG.md](CHANGELOG.md) for history.

## License

[MIT](LICENSE).
