import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireSession } from "@/lib/access";
import { readSoftwareCanon } from "@/lib/software";

export default async function SoftwareCanonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireSession();
  const { slug } = await params;

  let canon;
  try {
    canon = await readSoftwareCanon(slug);
  } catch {
    notFound();
  }

  const body = canon.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

  return (
    <main>
      <h1>{canon.software}</h1>
      <p className="muted">
        <Link href="/software">&larr; all software</Link>
        {canon.vendor && <> - {canon.vendor}</>}
        {canon.captured && <> - captured {canon.captured}</>}
        {canon.usedBy.length > 0 && <> - used by: {canon.usedBy.join(", ")}</>}
        {canon.docsUrl && (
          <>
            {" - "}
            <a href={canon.docsUrl} target="_blank" rel="noreferrer">
              vendor docs
            </a>
          </>
        )}
      </p>
      <div className="card sop-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </main>
  );
}
