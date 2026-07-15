import { getSourceControl, sopPath } from "@/lib/source-control";

export type SopMeta = {
  /** Repo path of the SOP file. */
  path: string;
  /** Filename without .md - the topic slug. */
  slug: string;
  topic: string;
  owner: string;
  updated: string;
  tools: string[];
};

export type Sop = SopMeta & { content: string };

/**
 * Minimal frontmatter reader for the sop-template shape. Deliberately not a
 * YAML parser - SOPs are app-authored, so the simple `key: value` /
 * `key: [a, b]` forms are all that appear.
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

function parseTools(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function toMeta(path: string, content: string): Sop {
  const fm = parseFrontmatter(content);
  const slug = path.split("/").pop()!.replace(/\.md$/, "");
  return {
    path,
    slug,
    topic: fm.topic || slug,
    owner: fm.owner ?? "",
    updated: fm.updated ?? "",
    tools: parseTools(fm.tools),
    content,
  };
}

/** All SOPs for one department (full content), [] when the folder is absent. */
export async function listSops(departmentSlug: string): Promise<Sop[]> {
  const provider = getSourceControl();
  const dir = `${sopPath()}/${departmentSlug}`;
  let entries;
  try {
    entries = await provider.listFiles(dir);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return [];
    throw e;
  }
  const files = entries.filter(
    (f) => f.type === "file" && f.name.endsWith(".md")
  );
  const sops = await Promise.all(
    files.map(async (f) => toMeta(f.path, await provider.readFile(f.path)))
  );
  return sops.sort((a, b) => a.topic.localeCompare(b.topic));
}

export async function readSop(path: string): Promise<Sop> {
  const content = await getSourceControl().readFile(path);
  return toMeta(path, content);
}

/** Department folders that exist under the SOP root (repo truth, not the DB). */
export async function listSopDepartments(): Promise<string[]> {
  try {
    const entries = await getSourceControl().listFiles(sopPath());
    return entries.filter((e) => e.type === "dir").map((e) => e.name);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return [];
    throw e;
  }
}

const CORPUS_BUDGET = 60_000; // chars, ~15k tokens - keeps the cached block bounded

/**
 * The corpus system block content (Document-with-Craig pattern): the manager's
 * own department SOPs in full, every other department's summarized to
 * frontmatter facts. Best-effort - callers treat null as "no corpus".
 */
export async function buildSopCorpus(
  departmentSlug: string
): Promise<string | null> {
  try {
    const departments = await listSopDepartments();
    if (!departments.length) return null;

    const parts: string[] = [];
    let spent = 0;

    if (departments.includes(departmentSlug)) {
      for (const sop of await listSops(departmentSlug)) {
        const chunk = `### ${sop.path}\n\n${sop.content}\n`;
        if (spent + chunk.length > CORPUS_BUDGET) {
          parts.push(`### ${sop.path}\n\n(omitted for length)\n`);
          continue;
        }
        parts.push(chunk);
        spent += chunk.length;
      }
    }

    const otherLines: string[] = [];
    for (const dept of departments.filter((d) => d !== departmentSlug)) {
      for (const sop of await listSops(dept)) {
        otherLines.push(
          `- ${sop.path} - topic: ${sop.topic}${
            sop.tools.length ? `, tools: ${sop.tools.join(", ")}` : ""
          }`
        );
      }
    }

    const sections: string[] = [];
    if (parts.length) {
      sections.push(
        `## This department's existing SOPs (full text)\n\n${parts.join("\n")}`
      );
    }
    if (otherLines.length) {
      sections.push(
        `## Other departments' SOPs (paths + tools only)\n\n${otherLines.join("\n")}`
      );
    }
    return sections.length ? sections.join("\n\n") : null;
  } catch {
    return null; // corpus is best-effort; never block a drafting turn
  }
}
