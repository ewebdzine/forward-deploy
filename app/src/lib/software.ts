import { listSopDepartments, listSops, parseFrontmatter } from "@/lib/sops";
import { getSourceControl, softwareDocsPath } from "@/lib/source-control";

export type SoftwareCanon = {
  path: string;
  slug: string;
  software: string;
  vendor: string;
  captured: string;
  usedBy: string[];
  /** Short/common names managers use in SOP tools: lists, e.g. QuickBooks, QBO. */
  aliases: string[];
  /** Direct https URL to the product's logo image ("" when not captured). */
  logoUrl: string;
  docsUrl: string;
  content: string;
};

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function toCanon(path: string, content: string): SoftwareCanon {
  const fm = parseFrontmatter(content);
  const slug = path.split("/").pop()!.replace(/\.md$/, "");
  return {
    path,
    slug,
    software: fm.software || slug,
    vendor: fm.vendor ?? "",
    captured: fm.captured ?? "",
    usedBy: parseList(fm.used_by),
    aliases: parseList(fm.aliases),
    logoUrl: fm.logo?.startsWith("https://") ? fm.logo : "",
    docsUrl: fm.docs ?? "",
    content,
  };
}

/** All software canons in the repo, [] when the folder is absent. */
export async function listSoftwareCanons(): Promise<SoftwareCanon[]> {
  const provider = getSourceControl();
  let entries;
  try {
    entries = await provider.listFiles(softwareDocsPath());
  } catch (e) {
    if ((e as { status?: number }).status === 404) return [];
    throw e;
  }
  const files = entries.filter(
    (f) => f.type === "file" && f.name.endsWith(".md") && f.name !== "INDEX.md"
  );
  const canons = await Promise.all(
    files.map(async (f) => toCanon(f.path, await provider.readFile(f.path)))
  );
  return canons.sort((a, b) => a.software.localeCompare(b.software));
}

export async function readSoftwareCanon(slug: string): Promise<SoftwareCanon> {
  const path = `${softwareDocsPath()}/${slug}.md`;
  const content = await getSourceControl().readFile(path);
  return toCanon(path, content);
}

/**
 * Software canons applicable to a plan: explicitly cited canon files, plus
 * name/alias mentions (word-boundary) in the title and developer-facing
 * sections. Used to badge plan cards with the products they touch.
 */
export function matchPlanSoftware(
  plan: {
    title: string;
    sections: Record<string, string>;
    citations: string[];
  },
  canons: SoftwareCanon[]
): SoftwareCanon[] {
  const text = [
    plan.title,
    plan.sections.proposed_solution ?? "",
    plan.sections.affected_systems ?? "",
    plan.sections.current_process ?? "",
  ]
    .join("\n")
    .toLowerCase();

  return canons.filter((c) => {
    if (plan.citations.some((cit) => cit.includes(`${c.slug}.md`))) return true;
    return [c.software, ...c.aliases].some((name) => {
      const n = name.trim().toLowerCase();
      if (n.length < 3) return false;
      const re = new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
      return re.test(text);
    });
  });
}

export type UndocumentedTool = {
  /** The tool name as the SOPs spell it (most common spelling wins). */
  tool: string;
  /** Department slugs whose SOPs name it. */
  departments: string[];
};

function normalizeTool(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * The documentation gap list: every tool named in an SOP `tools:` list with
 * no matching software canon. Pure repo derivation - the SOPs are the signal,
 * the canon folder is the answer, no extra state to maintain.
 */
export async function findUndocumentedTools(
  canons?: SoftwareCanon[]
): Promise<UndocumentedTool[]> {
  const known = new Set<string>();
  for (const c of canons ?? (await listSoftwareCanons().catch(() => []))) {
    known.add(normalizeTool(c.software));
    known.add(normalizeTool(c.slug));
    for (const alias of c.aliases) known.add(normalizeTool(alias));
  }

  const found = new Map<string, { tool: string; departments: Set<string> }>();
  const departments = await listSopDepartments().catch(() => []);
  for (const dept of departments) {
    for (const sop of await listSops(dept).catch(() => [])) {
      for (const tool of sop.tools) {
        const key = normalizeTool(tool);
        if (!key || known.has(key)) continue;
        const entry = found.get(key) ?? { tool, departments: new Set() };
        entry.departments.add(dept);
        found.set(key, entry);
      }
    }
  }

  return [...found.values()]
    .map((e) => ({ tool: e.tool, departments: [...e.departments].sort() }))
    .sort(
      (a, b) =>
        b.departments.length - a.departments.length ||
        a.tool.localeCompare(b.tool)
    );
}
