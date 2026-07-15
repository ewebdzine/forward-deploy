---
name: capture-software
description: Research one vendor software product the company uses (Zoom, QuickBooks, ...) from its public documentation and write a software canon - APIs, webhooks, auth, rate limits, docs links - into docs/software/<slug>.md, then regenerate docs/software/INDEX.md. The plan builder reads these so it already knows a tool's integration surface when a manager mentions it. Run when the user types /forward-deploy:capture-software, or says "add a software canon for X", "document Zoom for forward deploy", "research the <vendor> API", "the managers keep mentioning <software>, capture it".
---

# Capture-software - document a vendor's integration surface

The dev-side research gate. Managers name the software they use in SOPs and plans; this gate
gives Forward Deploy real knowledge of each product: what APIs, webhooks, and docs it has, so
the plan builder assesses integration feasibility from facts instead of asking the manager
questions they can't answer. One canon per product, in `docs/software/`, with an `INDEX.md`
breadth map - the same folder-plus-index convention as the department SOPs.

> The **software canon directory** is `docs/software/` (`SOFTWARE_DOCS_PATH` if overridden -
> check `forward-deploy.json` / the app env). The app never researches the web itself; research
> happens HERE in Claude Code, the reviewed result gets committed, and the app reads it.

## How to run

1. **Pick the target(s).** From the user's request, or - when asked to "catch up" - harvest
   candidates from the SOP indexes: every `tools:` entry in `docs/sops/*/INDEX.md` without a
   matching canon in `docs/software/`. Confirm the list before researching.

2. **Research the public documentation** (web search + fetch): the vendor's developer portal /
   docs center. Capture per product:
   - **What it is** - one line, and how THIS company uses it (from the SOPs that list it).
   - **API surface** - REST/GraphQL/SDKs, the major resource areas, docs URLs.
   - **Webhooks/events** - what it can push, subscription model.
   - **Auth model** - OAuth2 / API key / service account; who'd provision it.
   - **Plans & limits that gate integration** - API only on higher tiers, rate limits, sandbox availability.
   - **Docs links** - developer home, API reference, webhooks guide, status page.
   Note the retrieval date; vendor docs drift.

3. **Write the canon** at `docs/software/<slug>.md` (kebab-case product name) with frontmatter:

   ```yaml
   ---
   software: <Product name>
   slug: <kebab-slug>
   vendor: <Company>
   captured: <YYYY-MM-DD>
   used_by: [<department slugs whose SOPs list it>]
   aliases: [<short/common names managers use in SOP tools: lists, e.g. QuickBooks, QBO>]
   docs: <developer docs home URL>
   ---
   ```

   Then the sections: What it is / How we use it / API surface / Webhooks & events /
   Auth & provisioning / Limits & tiers / Docs links. Terse, factual, link-heavy - the plan
   builder reads this mid-conversation, so favor scannable lists over prose.

4. **Regenerate `docs/software/INDEX.md`** - one line per canon: `- **<software>**
   (`<slug>.md`) - used by: <departments> - <one-line what-it-is>`. Machine-scannable; note at
   the top that Forward Deploy's plan builder routes through it.

5. **Show, then commit.** Present the canon for review (the human vouches for accuracy before it
   becomes planning ground-truth), then commit the canon + INDEX to the configured branch with a
   message like `Software canon: <product> (via /forward-deploy:capture-software)`.

## Don't do

- **Don't invent API capabilities.** Every claim comes from the vendor's docs, with the URL. If
  the docs are paywalled or thin, say so in the canon - "unknown" is valuable planning data too.
- **Don't capture credentials or account specifics** - no API keys, account IDs, or tenant URLs;
  the canon documents the product, not the company's account.
- **Don't duplicate an existing canon.** If `docs/software/<slug>.md` exists, refresh it (compare
  against the current docs, bump `captured:`) instead of writing a second file.
- **Don't commit without review.** The plan builder will treat this as truth; the human confirms.

## Output template

```
FORWARD DEPLOY - software canon: <product>

Wrote docs/software/<slug>.md (captured <date>)
  API: <one-line summary>   Webhooks: <yes/no - one line>   Auth: <model>
  Flags: <tier/limit gotchas, or none>
Regenerated docs/software/INDEX.md (<N> products documented)
Committed: <sha> (or: awaiting review)

Gap check: SOP tools still without a canon: <list, or none>
```
