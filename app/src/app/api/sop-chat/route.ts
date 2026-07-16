import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { canAccessDepartment, findDepartment } from "@/lib/access";
import { buildSopCorpus } from "@/lib/sops";
import { sopPath } from "@/lib/source-control";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_HISTORY_TURNS = 12; // chat text only, never tool calls (Craig pattern)

type ChatTurn = { role: "user" | "assistant"; content: string };

type SopChatRequest = {
  departmentSlug: string;
  message: string;
  history?: ChatTurn[];
  /** The live draft from the editor pane - resent every turn to re-ground Claude. */
  draft?: { title?: string; markdown?: string };
  /** Set when revising an existing SOP: its repo path. */
  revisePath?: string;
};

const SET_SOP_TITLE_TOOL: Anthropic.Tool = {
  name: "set_sop_title",
  description:
    "Set (or update) the SOP's working title and filename slug as soon as you understand what " +
    "process is being documented - typically from the manager's FIRST message, well before any " +
    "draft. Call it again if the conversation narrows or changes the focus.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Human-readable SOP title, e.g. 'QuickBooks invoicing'",
      },
      topic_slug: {
        type: "string",
        description: "kebab-case filename slug, e.g. 'quickbooks-invoicing'",
      },
    },
    required: ["title", "topic_slug"],
  },
};

const UPDATE_SOP_DRAFT_TOOL: Anthropic.Tool = {
  name: "update_sop_draft",
  description:
    "Replace the SOP draft with a new COMPLETE version. Call this whenever you have enough " +
    "information to draft or meaningfully improve the document. Always return the ENTIRE " +
    "document (frontmatter + every section), never a fragment or a diff - the editor is " +
    "replaced wholesale. Keep chatting without this tool while you are still gathering facts.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Human-readable SOP title, e.g. 'QuickBooks invoicing'",
      },
      topic_slug: {
        type: "string",
        description:
          "kebab-case filename slug for this SOP, e.g. 'quickbooks-invoicing'. " +
          "Keep it stable across revisions of the same document.",
      },
      markdown: {
        type: "string",
        description:
          "The complete SOP markdown file: YAML frontmatter block first, then the sections.",
      },
    },
    required: ["title", "topic_slug", "markdown"],
  },
};

function identityBlock(
  departmentName: string,
  departmentSlug: string,
  authorName: string,
  revisePath?: string
): string {
  return `You are the SOP drafting assistant in Forward Deploy, working with a department manager to document their department. You interview them about one process at a time, then draft it as a Standard Operating Procedure.

Rules:
- Name it immediately: on your first reply, call set_sop_title with a working title based on what the manager described - before any drafting. Update it if the focus changes.
- Interview first, write second. Ask the questions a good analyst would, ONE at a time; don't draft from a one-line description. Once you have the essentials, call update_sop_draft and keep refining it each turn.
- Format your question distinctly: end the reply with a markdown blockquote line of the form "> **Question:** ..." with any commentary as normal prose above it. One blockquote per reply, always last.
- One SOP documents ONE process, tool, or recurring workflow. Several small SOPs beat one giant one. If the manager describes multiple distinct processes, say so, help them pick one to document now, and note the others as follow-ups.
- The document must follow this exact structure - YAML frontmatter, then these sections:

---
department: ${departmentName}
topic: <short-kebab-slug>
owner: ${authorName}
updated: <today's date, YYYY-MM-DD>
tools: [<software/services this process touches>]
---

## What this covers
## Who's involved
## Tools & accounts
## The process, step by step
## Pain points
## Definitions & edge cases

- The "tools:" frontmatter list is load-bearing (it powers cross-department analysis): name every piece of software the process touches, consistently with how other SOPs name them.
- Document what REALLY happens, including workarounds - not the idealized process. Pain points are candidate development projects; be concrete about frequency and cost.
- Plain markdown only: headings, paragraphs, numbered/bulleted lists, bold/italic, tables. No HTML.
- The document is neutral and professional; your chat replies can be warm, but never write the SOP in a chatty voice.
- Department: ${departmentName} (folder: ${sopPath()}/${departmentSlug}/). Manager: ${authorName}.${
    revisePath
      ? `\n- REVISE MODE: you are revising the existing SOP at ${revisePath}. Return the COMPLETE updated document each time; match its existing structure and tone; keep its topic_slug; if it contains anything you cannot carry over faithfully, keep the rest and tell the manager in chat what needs their attention - never silently drop content.`
      : ""
  }`;
}

function corpusBlock(corpus: string): string {
  return `Existing SOP corpus, for context. Use it to keep terminology and tool names consistent, to flag overlap with SOPs that already exist (say so in chat rather than duplicating), and to spot cross-department patterns worth mentioning. Do not copy passages verbatim into the new SOP.

${corpus}`;
}

function draftBlock(draft: { title?: string; markdown?: string }): string {
  return `The CURRENT draft in the manager's editor (they may have edited it by hand since your last version - this is the authoritative state to build on):

Title: ${draft.title || "(untitled)"}

${draft.markdown || "(empty)"}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: SopChatRequest;
  try {
    body = (await req.json()) as SopChatRequest;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.departmentSlug || !body.message?.trim()) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const department = await findDepartment(body.departmentSlug);
  if (!department) {
    return NextResponse.json({ error: "Unknown department" }, { status: 404 });
  }
  if (!(await canAccessDepartment(session, department.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      reply:
        "The drafting assistant isn't available in this environment (no Anthropic API key is configured). You can still write the SOP by hand in the editor and commit it.",
      draft: null,
    });
  }

  // System blocks in prefix-cache order: stable identity first, the corpus
  // cache-marked in the middle, the volatile current-draft block LAST.
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: identityBlock(
        department.name,
        department.slug,
        session.user.name ?? session.user.email,
        body.revisePath
      ),
    },
  ];
  const corpus = await buildSopCorpus(department.slug);
  if (corpus) {
    system.push({
      type: "text",
      text: corpusBlock(corpus),
      cache_control: { type: "ephemeral" },
    });
  }
  if (body.draft && (body.draft.title || body.draft.markdown)) {
    system.push({ type: "text", text: draftBlock(body.draft) });
  }

  const history = (body.history ?? [])
    .filter((t) => t.role === "user" || t.role === "assistant")
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: String(t.content) }));

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: body.message },
  ];

  let reply = "";
  let draft: { title: string; topic_slug: string; markdown: string } | null =
    null;
  let titleUpdate: { title: string; topic_slug: string } | null = null;

  // Small tool loop (title + draft are metadata tools, not exploration) so
  // Claude can set the title on its first reply and keep talking.
  try {
    for (let round = 0; round < 4; round++) {
      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
        max_tokens: 8192,
        system,
        messages,
        tools: [SET_SOP_TITLE_TOOL, UPDATE_SOP_DRAFT_TOOL],
        tool_choice: { type: "auto" },
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) reply = reply ? `${reply}\n\n${text}` : text;

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      if (response.stop_reason !== "tool_use" || !toolUses.length) break;

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        if (use.name === "set_sop_title") {
          titleUpdate = use.input as { title: string; topic_slug: string };
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: "Title set.",
          });
        } else if (use.name === "update_sop_draft") {
          draft = use.input as {
            title: string;
            topic_slug: string;
            markdown: string;
          };
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: "Draft applied to the editor.",
          });
        } else {
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: `Unknown tool: ${use.name}`,
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Claude call failed: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    reply:
      reply || (draft ? "I've updated the draft - take a look." : ""),
    draft,
    titleUpdate,
  });
}
