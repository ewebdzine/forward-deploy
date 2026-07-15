import { BitbucketProvider } from "./bitbucket";
import { GitHubProvider } from "./github";
import type { SourceControlProvider } from "./types";

export type { RepoEntry, SearchHit, SourceControlProvider } from "./types";

let provider: SourceControlProvider | undefined;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set - see app/.env.example`);
  return v;
}

export function sourceProviderName(): "github" | "bitbucket" {
  return process.env.SOURCE_PROVIDER === "bitbucket" ? "bitbucket" : "github";
}

/** The configured provider: GitHub (default) or Bitbucket (SOURCE_PROVIDER=bitbucket). */
export function getSourceControl(): SourceControlProvider {
  if (!provider) {
    provider =
      sourceProviderName() === "bitbucket"
        ? new BitbucketProvider(
            requireEnv("REPO_OWNER"), // the Bitbucket workspace
            requireEnv("REPO_NAME"), // the repo slug
            process.env.REPO_BRANCH ?? "main",
            requireEnv("BITBUCKET_EMAIL"),
            requireEnv("BITBUCKET_API_TOKEN")
          )
        : new GitHubProvider(
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

/** Software canons: one doc per product the company uses (Zoom, QuickBooks, ...). */
export function softwareDocsPath(): string {
  return process.env.SOFTWARE_DOCS_PATH ?? "docs/software";
}
