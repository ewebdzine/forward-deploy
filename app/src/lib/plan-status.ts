/**
 * The plan status workflow. Managers move draft/changes_requested -> submitted
 * (via submitPlan); everything below is the dev team's side of the board.
 */
export const PLAN_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "in_development",
  "shipped",
  "declined",
] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** Transitions a developer/admin may make, from -> [to]. */
const DEV_TRANSITIONS: Record<string, PlanStatus[]> = {
  submitted: ["in_review", "changes_requested", "approved", "declined"],
  in_review: ["changes_requested", "approved", "declined"],
  changes_requested: ["in_review", "approved", "declined"],
  approved: ["in_development", "declined"],
  in_development: ["shipped", "approved"],
  shipped: [],
  declined: ["in_review"],
  draft: [],
};

export function devTransitionsFrom(status: string): PlanStatus[] {
  return DEV_TRANSITIONS[status] ?? [];
}

export function isValidDevTransition(from: string, to: string): boolean {
  return devTransitionsFrom(from).includes(to as PlanStatus);
}
