import { parseFrontmatter } from "@/lib/sops";
import { getSourceControl, softwareDocsPath } from "@/lib/source-control";

export type SoftwareCanon = {
  path: string;
  slug: string;
  software: string;
  vendor: string;
  captured: string;
  usedBy: string[];
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
