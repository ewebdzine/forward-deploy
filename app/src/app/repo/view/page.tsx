import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/access";
import { getSourceControl } from "@/lib/source-control";

export const metadata = { title: "File - Forward Deploy" };

export default async function RepoViewPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  await requireSession();
  const { path } = await searchParams;
  if (!path) notFound();

  let content: string | undefined;
  let error: string | undefined;
  try {
    content = await getSourceControl().readFile(path);
  } catch (e) {
    error = (e as Error).message;
  }

  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

  return (
    <main>
      <h1>{path}</h1>
      <p className="muted">
        <Link href={`/repo?path=${encodeURIComponent(dir)}`}>
          &larr; back to {dir || "root"}
        </Link>
      </p>
      {error ? (
        <div className="card">
          <span className="badge-warn">Could not read the file:</span> {error}
        </div>
      ) : (
        <pre className="file-view">{content}</pre>
      )}
    </main>
  );
}
