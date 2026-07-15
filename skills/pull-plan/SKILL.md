---
name: pull-plan
description: Fetch an approved plan from your Forward Deploy instance into Claude Code as the implementation brief - sections, cited canons/files, mockup HTML saved locally - then hand off to planning/building (pairs with /canonify:build). Run when the user types /forward-deploy:pull-plan, or says "pull plan <id>", "bring in the approved plan", "start building the <title> plan", "implement the plan from forward deploy".
---

# Pull-plan - from the manager's plan to the developer's editor

The hand-off gate - the last edge of the Forward Deploy loop. A manager's plan was reviewed and
approved in the app; this gate pulls it into Claude Code laid out as an implementation brief, so
the build starts from the manager's full context instead of a ticket summary.

> Vocabulary: see `/forward-deploy:review-plans`. This gate consumes plans with status `approved`
> (or later); for triaging `submitted` plans, use review-plans.

## How to run

1. **Locate the instance.** `forward-deploy.json` -> `appUrl`; `FORWARD_DEPLOY_TOKEN` -> bearer
   token. Missing either -> point at `/forward-deploy:kickoff` and stop.

2. **Pick the plan.** If the user gave an id/title, fetch it; otherwise
   `GET /api/plans?status=approved` and let them choose.

3. **Fetch + lay out.** `GET /api/plans/<id>`:
   - Render every section in plan-guidelines order - Problem, Current process & inefficiency,
     Proposed solution, Affected systems & existing patterns, Open questions, Rough scope signal.
   - Save each mockup to `docs/plans/<id>-mockup-<n>.html` (or a path the user prefers) so it can
     be opened in a browser while building.
   - List the cited canons and `file:line` references as the reading list.

4. **Verify the citations.** Plans age: spot-check that cited files/canons still exist and still
   say what the plan assumes (the same freshness discipline as `/canonify:doctor`). Flag drift
   loudly before any code is planned on top of it.

5. **Hand off to the build.** Recommend the natural next step and stop there:
   - `/canonify:build` with the plan's task framing (it routes to the implicated canons), or
     plan mode with the brief as context.
   - `PATCH /api/plans/<id>` to `in_development` - propose it, confirm, then set it, so the
     manager sees the status move.

6. **Close the loop later.** When the work ships, remind the user to set the plan to `shipped`
   and drop a final thread message to the manager (via review-plans).

## Don't do

- **Don't start implementing inside this gate.** It delivers the brief and hands off; the build
  is its own session/plan.
- **Don't pull `draft`/`submitted` plans as briefs.** Those belong to review-plans; building from
  an unapproved plan skips the dev review the workflow exists for.
- **Don't trust stale citations.** Verify before building; a plan approved three weeks ago may
  reference moved code.
- **Don't dump mockup HTML into the terminal.** Save to files and link them.

## Output template

```
FORWARD DEPLOY - pulled plan #<id>: <title>   [approved <date>]
Department/author: <department> / <author>

<sections, in plan-guidelines order>

Reading list (citations): <canon/file:line list, each marked ok|stale>
Mockups: docs/plans/<id>-mockup-1.html, ...
Thread highlights: <decisions made during review>

Status: in_development <set | proposed>
Next: /canonify:build "<task framing>"  (or enter plan mode with this brief)
```
