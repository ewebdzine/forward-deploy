# SOP template - one document per department process

An SOP documents one slice of a department: one process, one tool, one recurring workflow.
Several small SOPs beat one giant one - they route better when Claude builds plans. The app's
SOP builder interviews the manager and writes in this shape, committed to
`docs/sops/<department>/<topic>.md`.

Frontmatter every SOP carries:

```yaml
---
department: <department name>
topic: <short-kebab-slug>
owner: <manager name/email>
updated: <YYYY-MM-DD>
tools: [<software/services this process touches, e.g. Zoom, QuickBooks, spreadsheet>]
---
```

The `tools:` list is load-bearing: it is how cross-department patterns surface (three SOPs
listing `Zoom` is a consolidation flag).

---

## What this covers

One or two sentences: the process this SOP documents and when it happens (daily / per-order /
monthly close / ad hoc).

## Who's involved

Roles, not just names: who initiates, who approves, who receives the output. Include hand-offs
to other departments explicitly - those edges are where plans find integrations.

## Tools & accounts

Each tool this process touches: what it is used for here, who holds the account/license, and
whether it is department-owned or company-wide. Note exports/imports between tools (the CSV that
gets downloaded from A and pasted into B is usually the plan).

## The process, step by step

Numbered steps, in the words the department actually uses. For each step where it applies: the
tool used, time it takes, and what can go wrong. Do not idealize - document what really happens,
including the workarounds.

## Pain points

The honest list: the slow parts, the error-prone parts, the "someone has to remember to" parts,
the duplicate data entry. Each pain point is a candidate plan - be concrete about frequency and
cost ("~2 hrs every Friday", "wrong about once a month, and a customer notices").

## Definitions & edge cases

Department vocabulary a developer would not know, and the exceptions to the process above (the
rush order, the year-end variant, the one big client handled differently).
