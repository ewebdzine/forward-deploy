import Link from "next/link";
import { requireSession } from "@/lib/access";
import { getSourceControl, repoDescription } from "@/lib/source-control";

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

  const parent = path.includes("/")
    ? path.slice(0, path.lastIndexOf("/"))
    : "";

  return (
    <main>
      <h1>Repository</h1>
      <p className="muted">
        {repoDescription()}
        {path ? ` / ${path}` : ""} - read-only view of the codebase, canons, and
        SOPs your plans draw from.
      </p>

      {error ? (
        <div className="card">
          <span className="badge-warn">Could not read the repo:</span> {error}
        </div>
      ) : (
        <div className="card">
          <ul className="file-list">
            {path && (
              <li>
                <Link href={`/repo?path=${encodeURIComponent(parent)}`}>
                  &larr; up
                </Link>
              </li>
            )}
            {entries!.map((e) =>
              e.type === "dir" ? (
                <li key={e.path}>
                  &#128193;{" "}
                  <Link href={`/repo?path=${encodeURIComponent(e.path)}`}>
                    {e.name}/
                  </Link>
                </li>
              ) : (
                <li key={e.path}>
                  &#128196;{" "}
                  <Link href={`/repo/view?path=${encodeURIComponent(e.path)}`}>
                    {e.name}
                  </Link>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </main>
  );
}
