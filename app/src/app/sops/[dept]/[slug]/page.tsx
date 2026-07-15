import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { canAccessDepartment, findDepartment, requireSession } from "@/lib/access";
import { readSop } from "@/lib/sops";
import { sopPath } from "@/lib/source-control";

export default async function SopViewPage({
  params,
}: {
  params: Promise<{ dept: string; slug: string }>;
}) {
  const session = await requireSession();
  const { dept, slug } = await params;
  const department = await findDepartment(dept);
  if (!department) notFound();
  if (!(await canAccessDepartment(session, department.id))) redirect("/sops");

  let sop;
  try {
    sop = await readSop(`${sopPath()}/${department.slug}/${slug}.md`);
  } catch {
    notFound();
  }

  const body = sop.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

  return (
    <main>
      <h1>{sop.topic}</h1>
      <p className="muted">
        <Link href={`/sops/${department.slug}`}>&larr; {department.name} SOPs</Link>
        {" - "}
        {sop.owner && <>owner {sop.owner}, </>}
        {sop.updated && <>updated {sop.updated}, </>}
        {sop.tools.length > 0 && <>tools: {sop.tools.join(", ")}</>}
      </p>
      <div className="card sop-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
      <p>
        <Link href={`/sops/${department.slug}/${slug}/revise`}>
          Revise with Claude
        </Link>
      </p>
    </main>
  );
}
