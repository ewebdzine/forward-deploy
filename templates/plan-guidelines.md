# Plan guidelines - the outline every Forward Deploy plan follows

The app's plan builder holds Claude to this structure. Every plan a manager submits has these
sections, in this order, so developers review a consistent document and `pull-plan` can lay it
out mechanically. Sections marked *(required)* must be filled before a plan can leave `draft`.

Rules for the plan builder (Claude, in the app):

- **Interview first, write second.** Ask the clarifying questions a good developer would ask;
  do not draft sections from a one-line idea.
- **Ground every feasibility claim.** "The codebase already has X" must cite a canon or a
  `file:line`; "we'd need to build Y" must note what was searched and not found.
- **Cross-department sight is the point.** Check other departments' SOPs for the same pain or
  the same tool; say so in the plan when found.
- **Managers speak process, not code.** Keep the plan's language operational; the citations
  carry the technical weight.
- **Scope signal, not an estimate.** Rough order (small / medium / large / needs-a-spike) plus
  what drives it. Never promise dates on the developers' behalf.

---

## 1. Problem *(required)*

What hurts, who it hurts, how often. One tight paragraph a developer with no department context
can understand. No solutions here.

## 2. Current process & inefficiency *(required)*

How the work is done today, step by step - the manual path, the tools involved (name them: the
SOPs are the source), where time/money/accuracy is lost, and roughly how much. Cite the
department SOP(s) this comes from.

## 3. Proposed solution *(required)*

What the manager wants to exist, described as outcomes and workflow ("when a meeting ends, the
summary appears in X and the follow-ups are drafted"), not implementation. Note alternatives
considered and why this shape.

## 4. Affected systems & existing patterns *(required)*

The developer-facing section, written by Claude from exploration:
- Existing code/features this touches or builds on - `file:line` citations.
- Canons that apply (the established pattern for the integration/UI/service involved).
- Other departments' SOPs that intersect (same tool, same data, same pain) - the consolidation
  opportunities.
- What does NOT exist yet (searched for, not found) - the genuinely new build.

## 5. Mockups *(as applicable)*

High-level HTML mockups of any new/changed screens, generated from the company profile's
branding tokens. Look-and-feel and layout only - production code comes later. Each mockup gets a
one-line caption of what it shows.

## 6. Open questions *(required, may be "none")*

What the manager could not answer and who can; decisions deliberately left to the developers;
data/access unknowns (does the vendor have an API? who owns that account?).

## 7. Rough scope signal *(required)*

Small / medium / large / needs-a-spike, with one sentence on the driver ("large: no existing
integration with <vendor>, and three departments' workflows change"). Claude sets this from
section 4's findings; the dev team owns the real estimate.
