/**
 * The plan outline - mirrors templates/plan-guidelines.md. Section keys are
 * the contract between the update_plan tool, the plans.sections jsonb, and
 * every render surface (builder pane, view page, pull-plan skill).
 */
export const PLAN_SECTIONS = [
  {
    key: "problem",
    label: "Problem",
    required: true,
    hint: "What hurts, who it hurts, how often - no solutions here.",
  },
  {
    key: "current_process",
    label: "Current process & inefficiency",
    required: true,
    hint: "How the work is done today, step by step, and where time/money/accuracy is lost. Cite the SOPs.",
  },
  {
    key: "proposed_solution",
    label: "Proposed solution",
    required: true,
    hint: "Outcomes and workflow, not implementation. Alternatives considered.",
  },
  {
    key: "affected_systems",
    label: "Affected systems & existing patterns",
    required: true,
    hint: "Existing code/canons this touches (file:line citations), intersecting SOPs, and what genuinely doesn't exist yet.",
  },
  {
    key: "open_questions",
    label: "Open questions",
    required: true,
    hint: "Unknowns, who can answer them, decisions left to the developers. 'None' is acceptable.",
  },
  {
    key: "scope_signal",
    label: "Rough scope signal",
    required: true,
    hint: "small / medium / large / needs-a-spike, with one sentence on the driver.",
  },
] as const;

export type PlanSectionKey = (typeof PLAN_SECTIONS)[number]["key"];

export function sectionLabel(key: string): string {
  return PLAN_SECTIONS.find((s) => s.key === key)?.label ?? key;
}

/** Required sections that are still empty - gates draft -> submitted. */
export function missingRequiredSections(
  sections: Record<string, string>
): string[] {
  return PLAN_SECTIONS.filter(
    (s) => s.required && !(sections[s.key] ?? "").trim()
  ).map((s) => s.label);
}

/** How many sections have content - the n in "n/6 sections". */
export function filledSectionCount(sections: Record<string, string>): number {
  return PLAN_SECTIONS.filter((s) => (sections[s.key] ?? "").trim()).length;
}

/** Bullet lines from the open_questions section markdown ("none" -> []). */
export function parseOpenQuestions(
  sections: Record<string, string>
): string[] {
  const body = (sections.open_questions ?? "").trim();
  if (!body || /^none\b/i.test(body)) return [];
  return body
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 8)
    .map((l) => l.replace(/\*\*/g, ""));
}
