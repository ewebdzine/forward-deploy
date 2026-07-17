import { Octokit } from "@octokit/rest";
import type {
  RepoEntry,
  SearchHit,
  SourceControlProvider,
} from "./types";

export class GitHubProvider implements SourceControlProvider {
  private octokit: Octokit;

  constructor(
    private owner: string,
    private repo: string,
    private branch: string,
    token: string
  ) {
    this.octokit = new Octokit({ auth: token });
  }

  async listFiles(path: string): Promise<RepoEntry[]> {
    const res = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
      ref: this.branch,
    });
    const data = Array.isArray(res.data) ? res.data : [res.data];
    return data
      .filter((e) => e.type === "file" || e.type === "dir")
      .map((e) => ({
        name: e.name,
        path: e.path,
        type: e.type as "file" | "dir",
        ...(e.type === "file" && typeof e.size === "number"
          ? { size: e.size }
          : {}),
      }))
      .sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
      );
  }

  async readFile(path: string): Promise<string> {
    const res = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
      ref: this.branch,
    });
    if (Array.isArray(res.data) || res.data.type !== "file") {
      throw new Error(`Not a file: ${path}`);
    }
    if (!("content" in res.data) || res.data.content === undefined) {
      throw new Error(`No content returned for ${path} (too large?)`);
    }
    return Buffer.from(res.data.content, "base64").toString("utf-8");
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.branch,
      });
      return true;
    } catch (e) {
      if ((e as { status?: number }).status === 404) return false;
      throw e;
    }
  }

  async search(query: string): Promise<SearchHit[]> {
    const res = await this.octokit.search.code({
      q: `${query} repo:${this.owner}/${this.repo}`,
      per_page: 20,
    });
    return res.data.items.map((item) => ({
      path: item.path,
      fragments:
        item.text_matches?.map((m) => m.fragment ?? "").filter(Boolean) ?? [],
    }));
  }

  async commitFile(
    path: string,
    content: string,
    message: string
  ): Promise<string> {
    // createOrUpdateFileContents needs the current SHA when the file exists.
    let sha: string | undefined;
    try {
      const existing = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.branch,
      });
      if (!Array.isArray(existing.data) && existing.data.type === "file") {
        sha = existing.data.sha;
      }
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
    }

    const res = await this.octokit.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path,
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch: this.branch,
      ...(sha ? { sha } : {}),
    });
    return res.data.commit.sha ?? "";
  }
}
