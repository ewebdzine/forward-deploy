---
name: review-plans
description: Dev-side review gate - list the plans department managers have submitted to your Forward Deploy instance, open one in the terminal (sections, cited canons/files, mockups), and reply in its review thread or advance its status. Run when the user types /forward-deploy:review-plans, or says "any new plans", "check the plan queue", "review the submitted plans", "what did the managers submit", "reply to that plan".
---

# Review-plans - work the plan queue from Claude Code

The dev-side review gate. Managers build plans in the app; this gate brings the queue to the
developer's terminal: list what is submitted, read one plan in full, post replies into its
manager <-> developer thread, and advance its status - without leaving Claude Code.

> Vocabulary: a **plan** is a structured proposal a manager built in the app (sections per
> `templates/plan-guidelines.md`, mockups, cited canons/files). Statuses flow
> `draft -> submitted -> in_review -> changes_requested / approved -> in_development -> shipped`
> (+ `declined`). The instance lives at `forward-deploy.json`'s `appUrl`; auth is the
> `FORWARD_DEPLOY_TOKEN` env var as a bearer token.

## How to run

1. **Locate the instance.** Read `forward-deploy.json` at the repo root (`appUrl`) and
   `FORWARD_DEPLOY_TOKEN` from the environment / local `.env`. Missing either -> point at
   `/forward-deploy:kickoff` and stop.

2. **List.** `GET <appUrl>/api/plans?status=submitted,in_review,changes_requested` - show a
   compact queue: id, title, department, author, status, last activity, unread thread count.

3. **Open one** (the user picks). `GET <appUrl>/api/plans/<id>` - render the sections in order,
   the canon/file citations as `path:line` references, the thread so far, and note any mockups
   (offer to save each mockup's HTML to a local file for viewing - do not dump raw HTML to the
   terminal).

4. **Assess before replying.** The plan cites files and canons - spot-check the load-bearing ones
   in the actual repo so feedback is grounded ("the plan assumes X; the code does Y") rather than
   vibes. `/canonify:build`-style routing helps here.

5. **Act** (only what the user asks for):
   - **Reply:** `POST <appUrl>/api/plans/<id>/messages` with the drafted reply - show the draft
     and get a confirm before posting; it is outward-facing to the manager. Always include
     `authorEmail` set to `git config user.email` so the thread shows the actual developer, not
     the CLI system user (an unmatched email falls back to the system user harmlessly).
   - **Advance status:** `PATCH <appUrl>/api/plans/<id>` (e.g. `in_review`, `changes_requested`,
     `approved`) - state the transition before making it.
   - **Approved and ready to build?** Hand off to `/forward-deploy:pull-plan`.

## Don't do

- **Don't post a reply or change a status without showing it first.** Managers read these.
- **Don't review from the plan text alone.** Verify its key claims against the repo before
  agreeing or pushing back.
- **Don't paste secrets** (the token, env values) into output.
- **Don't edit the plan's content.** The plan is the manager's document; feedback goes in the
  thread, changes come from them (or from an agreed `changes_requested` round).

## Output template

```
FORWARD DEPLOY - plan queue (<N> open)

#<id>  <title>                <department> / <author>   <status>   <last activity>
...

--- on open ---
Plan #<id>: <title>   [<status>]   <department> / <author>
<sections, in plan-guidelines order>
Citations checked: <n> ok, <m> stale/wrong (detail)
Mockups: <k> (saved to <paths>)
Thread: <last few messages>

Actions: reply | set status | pull-plan
```

## Log the review's token usage (last step)

When the review wraps (status advanced or replies posted), report this session's token usage so
the plan's lifecycle view shows the full scope - review runs on the team's Claude plan, so it's
logged as subscription tokens at $0:

1. Sum this session's usage from the Claude Code transcript (newest `.jsonl` under
   `~/.claude/projects/<cwd-slug>/`): total the `message.usage` fields
   (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`)
   across assistant turns. Best-effort - skip silently if the transcript isn't readable.
2. `POST <appUrl>/api/plans/<id>/usage` with
   `{ "phase": "review", "tokensIn": ..., "tokensOut": ..., "tokensCacheWrite": ...,
      "tokensCacheRead": ..., "authorEmail": "<git config user.email>" }`
   (bearer `FORWARD_DEPLOY_TOKEN`).
3. Confirm in one line: "Logged <N> review tokens to the plan."
