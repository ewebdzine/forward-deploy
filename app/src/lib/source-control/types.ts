export type RepoEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
};

export type SearchHit = {
  path: string;
  /** Matched line fragments, when the provider supplies them. */
  fragments: string[];
};

/**
 * The seam Bitbucket (post-v1) plugs into. Everything the app knows about
 * source control goes through this interface - no Octokit outside github.ts.
 */
export interface SourceControlProvider {
  /** List entries at a directory path ("" = repo root). */
  listFiles(path: string): Promise<RepoEntry[]>;
  /** Read a file's text content at the configured branch. */
  readFile(path: string): Promise<string>;
  fileExists(path: string): Promise<boolean>;
  /** Code search scoped to the configured repo. */
  search(query: string): Promise<SearchHit[]>;
  /**
   * Create or update a file on the configured branch (SOP commits, Phase 2).
   * Returns the commit SHA.
   */
  commitFile(path: string, content: string, message: string): Promise<string>;
}
