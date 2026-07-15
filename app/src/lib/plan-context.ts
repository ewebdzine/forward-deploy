import { companyDocsPath, getSourceControl, repoDescription } from "@/lib/source-control";
import { buildIndexMarkdown, listSopDepartments, listSops } from "@/lib/sops";
import { PLAN_SECTIONS, sectionLabel } from "@/lib/plan-sections";

const CANONIFY_BUDGET = 50_000;
const PROFILE_BUDGET = 15_000;

function clip(text: string, budget: number): string {
  return text.length > budget
    ? `${text.slice(0, budget)}\n\n[...clipped for length]`
    : text;
}

/**
 * The cache-marked breadth block: CANONIFY.md, every department's SOP index,
 * and the company profile. Stable across the turns of a session, so it sits
 * mid-stack with cache_control - the same shape as the SOP builder's corpus.
 * Best-effort per source: a missing piece is noted, never fatal.
 */
export async function buildPlanBreadthBlock(): Promise<string> {
  const provider = getSourceControl();
  const parts: string[] = [
    `Repository: ${repoDescription()}. Explore it with the list_repo_files / read_repo_file / search_code tools - the maps below are summaries, the repo is the truth.`,
  ];

  try {
    const canonify = await provider.readFile("CANONIFY.md");
    parts.push(
      `## CANONIFY.md - the codebase's canonical-pattern manifest\n\nOne-line summaries of every documented pattern. Read the referenced canon doc (read_repo_file) before citing a pattern in the plan.\n\n${clip(canonify, CANONIFY_BUDGET)}`
    );
  } catch {
    parts.push(
      "## Canons\n\nNo CANONIFY.md found - the codebase has no canonical-pattern docs. Ground claims by exploring the code directly."
    );
  }

  try {
    const departments = await listSopDepartments();
    if (departments.length) {
      const indexes: string[] = [];
      for (const dept of departments) {
        const sops = await listSops(dept);
        if (sops.length) indexes.push(buildIndexMarkdown(dept, sops));
      }
      if (indexes.length) {
        parts.push(
          `## Department SOP indexes - every documented process, all departments\n\nCross-department sight is the point: check other departments for the same pain or the same tools. Read any SOP in full with read_repo_file before leaning on it.\n\n${indexes.join("\n\n")}`
        );
      }
    }
  } catch {
    // SOP map is best-effort
  }

  try {
    const profile = await provider.readFile(
      `${companyDocsPath()}/company-profile.md`
    );
    parts.push(
      `## Company profile - branding + product context (mockups MUST use these tokens)\n\n${clip(profile, PROFILE_BUDGET)}`
    );
  } catch {
    parts.push(
      `## Company profile\n\nNo ${companyDocsPath()}/company-profile.md found. Mockups will be generic - note that to the manager if they ask for one, and keep mockup styling neutral and clean.`
    );
  }

  return parts.join("\n\n---\n\n");
}

/**
 * The volatile current-plan block - LAST and uncached, rebuilt every turn
 * (the Craig re-grounding rule: history never carries tool calls, this block
 * is what tells Claude the plan's actual current state).
 */
export function buildPlanStateBlock(plan: {
  title: string;
  sections: Record<string, string>;
  citations: string[];
  mockupCaptions: string[];
}): string {
  const sections = PLAN_SECTIONS.map((s) => {
    const body = (plan.sections[s.key] ?? "").trim();
    return `### ${s.label} [${s.key}]${s.required ? " (required)" : ""}\n${body || "(empty)"}`;
  }).join("\n\n");

  return `The CURRENT state of the plan document (authoritative - build on this, don't restart):

Title: ${plan.title || "(untitled)"}

${sections}

Citations recorded: ${plan.citations.length ? plan.citations.join("; ") : "(none)"}
Mockups attached: ${
    plan.mockupCaptions.length
      ? plan.mockupCaptions.map((c, i) => `${i + 1}. ${c}`).join("; ")
      : "(none)"
  }

Section keys for update_plan: ${PLAN_SECTIONS.map((s) => s.key).join(", ")} (labels: ${PLAN_SECTIONS.map(
    (s) => sectionLabel(s.key)
  ).join(", ")}).`;
}
