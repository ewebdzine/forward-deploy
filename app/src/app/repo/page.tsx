import Link from "next/link";
import { requireSession } from "@/lib/access";
import { getSourceControl, repoDescription } from "@/lib/source-control";
import RepoTable from "@/components/repo-table";

export const metadata = { title: "Repo - Forward Deploy" };

export default async function RepoPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  await requireSession();
  const { path = "" } = await searchParams;

  let entries;
  let error: string | undefined;
  try {
    entries = await getSourceControl().listFiles(path);
  } catch (e) {
    error = (e as Error).message;
  }

  const crumbs = path ? path.split("/") : [];

  return (
    <main>
      <h1>Repository</h1>
      <p className="muted">
        {repoDescription()} - read-only view of the codebase, canons, and SOPs
        your plans draw from.
      </p>
      <p className="repo-crumbs">
        <Link href="/repo">{repoDescription().split("@")[0]}</Link>
        {crumbs.map((part, i) => {
          const upTo = crumbs.slice(0, i + 1).join("/");
          return (
            <span key={upTo}>
              {" / "}
              {i === crumbs.length - 1 ? (
                <strong>{part}</strong>
              ) : (
                <Link href={`/repo?path=${encodeURIComponent(upTo)}`}>
                  {part}
                </Link>
              )}
            </span>
          );
        })}
      </p>

      {error ? (
        <div className="card">
          <span className="badge-warn">Could not read the repo:</span> {error}
        </div>
      ) : (
        <RepoTable entries={entries!} path={path} />
      )}
    </main>
  );
}
