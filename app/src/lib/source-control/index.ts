import { GitHubProvider } from "./github";
import type { SourceControlProvider } from "./types";

export type { RepoEntry, SearchHit, SourceControlProvider } from "./types";

let provider: SourceControlProvider | undefined;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set - see app/.env.example`);
  return v;
}

/** The configured provider (v1: GitHub; Bitbucket is a post-v1 implementation). */
export function getSourceControl(): SourceControlProvider {
  if (!provider) {
    provider = new GitHubProvider(
      requireEnv("REPO_OWNER"),
      requireEnv("REPO_NAME"),
      process.env.REPO_BRANCH ?? "main",
      requireEnv("GITHUB_TOKEN")
    );
  }
  return provider;
}

export function repoDescription(): string {
  return `${process.env.REPO_OWNER}/${process.env.REPO_NAME}@${
    process.env.REPO_BRANCH ?? "main"
  }`;
}

export function sopPath(): string {
  return process.env.SOP_PATH ?? "docs/sops";
}

export function companyDocsPath(): string {
  return process.env.COMPANY_DOCS_PATH ?? "docs/company";
}
