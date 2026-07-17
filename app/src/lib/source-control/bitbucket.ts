import type {
  RepoEntry,
  SearchHit,
  SourceControlProvider,
} from "./types";

const API = "https://api.bitbucket.org/2.0";

type BbSrcEntry = {
  type: "commit_file" | "commit_directory";
  path: string;
  size?: number;
};

type BbPage<T> = { values: T[]; next?: string };

/**
 * Bitbucket Cloud implementation of the SourceControlProvider seam. Plain
 * fetch against the 2.0 REST API - no SDK. Auth is Basic with an Atlassian
 * account email + API token (an app password + username works identically).
 */
export class BitbucketProvider implements SourceControlProvider {
  private authHeader: string;

  constructor(
    private workspace: string,
    private repo: string,
    private branch: string,
    email: string,
    apiToken: string
  ) {
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const err = new Error(
        `Bitbucket API ${res.status} for ${url.replace(API, "")}`
      ) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    return res;
  }

  private srcUrl(path: string): string {
    const clean = path.replace(/^\/+|\/+$/g, "");
    return `${API}/repositories/${this.workspace}/${this.repo}/src/${encodeURIComponent(
      this.branch
    )}/${clean.split("/").map(encodeURIComponent).join("/")}`;
  }

  async listFiles(path: string): Promise<RepoEntry[]> {
    const entries: RepoEntry[] = [];
    let url: string | undefined = `${this.srcUrl(path)}${path ? "/" : ""}?pagelen=100`;
    while (url) {
      const res = await this.request(url);
      const page = (await res.json()) as BbPage<BbSrcEntry>;
      for (const e of page.values) {
        entries.push({
          name: e.path.split("/").pop() ?? e.path,
          path: e.path,
          type: e.type === "commit_directory" ? "dir" : "file",
          ...(e.type === "commit_file" && typeof e.size === "number"
            ? { size: e.size }
            : {}),
        });
      }
      url = page.next;
    }
    return entries.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
    );
  }

  async readFile(path: string): Promise<string> {
    // GET /src/{ref}/{path} on a file returns the raw content.
    const res = await this.request(this.srcUrl(path));
    return res.text();
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await this.request(`${this.srcUrl(path)}?format=meta`);
      return true;
    } catch (e) {
      if ((e as { status?: number }).status === 404) return false;
      throw e;
    }
  }

  async search(query: string): Promise<SearchHit[]> {
    // Workspace code search must be enabled in Bitbucket settings; degrade to
    // "no results" when it isn't (the plan builder navigates via list/read).
    try {
      const url = `${API}/workspaces/${this.workspace}/search/code?search_query=${encodeURIComponent(
        `repo:${this.repo} ${query}`
      )}&pagelen=20`;
      const res = await this.request(url);
      const page = (await res.json()) as BbPage<{
        file: { path: string };
        content_matches?: {
          lines?: { segments?: { text: string }[] }[];
        }[];
      }>;
      return page.values.map((v) => ({
        path: v.file.path,
        fragments: (v.content_matches ?? [])
          .flatMap((m) => m.lines ?? [])
          .map((l) => (l.segments ?? []).map((s) => s.text).join(""))
          .filter(Boolean)
          .slice(0, 5),
      }));
    } catch {
      return [];
    }
  }

  async commitFile(
    path: string,
    content: string,
    message: string
  ): Promise<string> {
    // POST /src commits form fields: {path}=content, message, branch.
    const form = new URLSearchParams();
    form.set(path, content);
    form.set("message", message);
    form.set("branch", this.branch);
    await this.request(`${API}/repositories/${this.workspace}/${this.repo}/src`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    // The POST returns no body; report the new branch head.
    try {
      const res = await this.request(
        `${API}/repositories/${this.workspace}/${this.repo}/refs/branches/${encodeURIComponent(this.branch)}`
      );
      const data = (await res.json()) as { target?: { hash?: string } };
      return data.target?.hash ?? "";
    } catch {
      return "";
    }
  }
}
