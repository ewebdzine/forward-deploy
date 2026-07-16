import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { canAccessDepartment } from "@/lib/access";
import { buildPlanBreadthBlock, buildPlanStateBlock } from "@/lib/plan-context";
import { PLAN_SECTIONS } from "@/lib/plan-sections";
import { getSourceControl, softwareDocsPath, sopPath } from "@/lib/source-control";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_HISTORY_TURNS = 12; // chat text only - tool traffic stays inside one call
const MAX_TOOL_ROUNDS = 12;
const FILE_BUDGET = 30_000;

type ChatTurn = { role: "user" | "assistant"; content: string };

type PlanChatRequest = {
  planId: string;
  message: string;
  history?: ChatTurn[];
};

const sectionProperties = Object.fromEntries(
  PLAN_SECTIONS.map((s) => [
    s.key,
    {
      type: "string",
      description: `${s.label}. ${s.hint} Complete replacement of this section's markdown when provided.`,
    },
  ])
);

const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_repo_files",
    description:
      "List files and folders at a path in the connected repository ('' = root). Use to orient before reading.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Directory path, '' for root" } },
      required: ["path"],
    },
  },
  {
    name: "read_repo_file",
    description:
      "Read a file from the repository: source code, canon docs, SOPs, company docs. Large files are clipped.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "search_code",
    description:
      "Search the repository's code and docs for a term (GitHub code search). Returns matching paths with fragments.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "update_plan",
    description:
      "Update the plan document. Provide only the fields you are changing; each provided section is a COMPLETE replacement of that section's markdown. Keep the manager's operational language in prose sections; put technical weight in citations. Update citations to the full current list whenever affected_systems changes.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Concise plan title" },
        sections: {
          type: "object",
          properties: sectionProperties,
          description: "Only the sections being replaced.",
        },
        citations: {
          type: "array",
          items: { type: "string" },
          description:
            "COMPLETE list of canon paths and file:line references the plan relies on, e.g. 'docs/services/ai.md', 'CeoWebsite/Foo.cs:120'.",
        },
      },
    },
  },
  {
    name: "create_mockup",
    description:
      "Attach a high-level HTML mockup to the plan - one self-contained HTML document (inline CSS/JS, no external resources) styled with the company profile's brand tokens and layout conventions. Look-and-feel only, not production code. Ask the manager what the screen should show before creating one.",
    input_schema: {
      type: "object",
      properties: {
        caption: { type: "string", description: "One line: what this mockup shows" },
        html: { type: "string", description: "Complete self-contained HTML document" },
      },
      required: ["caption", "html"],
    },
  },
];

function identityBlock(departmentName: string, managerName: string): string {
  return `You are the plan builder in Forward Deploy. You work with a department manager - a process expert, usually not technical - to turn an inefficiency or an idea into a developer-ready plan, exactly the way a senior developer runs a planning session.

How you work:
- Interview first, write second. Ask the clarifying questions a good developer would ask. Don't draft sections from a one-line idea.
- Ask ONE question at a time - never a battery of questions. When several things need answering, pick the highest-leverage one, ask it, and record the rest in the open_questions section so nothing is lost. When the manager answers one, resolve it (update the plan, remove it from open_questions) and ask the next.
- Resuming a session (the plan already has content): briefly recap where the plan stands in one or two sentences, then ask the single most important open question. Don't re-interview from scratch.
- Ground every feasibility claim. Before writing "the codebase already has X" - search or read it, then record the canon path or file:line in citations. Before writing "we'd need to build Y" - say what you searched and didn't find.
- Explore proactively: when the manager names a tool, a screen, or a process, check the breadth maps and read the implicated canons/SOPs/code in the same turn. Never claim you cannot see the codebase - you have tools.
- Cross-department sight is the point: check other departments' SOP indexes for the same pain or the same tools, and say so in the plan when it changes the shape of the solution (consolidation opportunities).
- Keep prose sections in the manager's operational language; the citations carry the technical weight.
- Scope signal, not an estimate: small / medium / large / needs-a-spike plus the driver. Never promise dates.
- Update the plan document incrementally with update_plan as facts land - the manager watches it grow beside the chat. Don't wait for a perfect final draft.
- Mockups: only when a screen is genuinely part of the proposal, after asking what it should show, styled strictly from the company profile tokens.
- One plan = one proposal. If the conversation surfaces a second distinct project, note it in chat as a follow-up plan.

Department: ${departmentName}. Manager: ${managerName}.`;
}

/** Human-readable activity line for the live progress feed, by tool call. */
function describeTool(
  name: string,
  input: Record<string, unknown>
): { kind: string; label: string } {
  const path = String(input.path ?? "");
  switch (name) {
    case "read_repo_file":
      if (path === "CANONIFY.md" || path.startsWith("docs/integrations/") || path.startsWith("docs/composite/") || path.startsWith("docs/services/") || path.startsWith("docs/design/")) {
        return { kind: "canon", label: `Reading canon: ${path}` };
      }
      if (path.startsWith(`${sopPath()}/`)) {
        return { kind: "sop", label: `Reading SOP: ${path.slice(sopPath().length + 1)}` };
      }
      if (path.startsWith(`${softwareDocsPath()}/`)) {
        return { kind: "software", label: `Reading software canon: ${path.split("/").pop()}` };
      }
      return { kind: "code", label: `Reading code: ${path}` };
    case "search_code":
      return { kind: "search", label: `Searching the codebase for "${String(input.query ?? "")}"` };
    case "list_repo_files":
      return { kind: "browse", label: `Browsing ${path || "the repo root"}` };
    case "update_plan":
      return { kind: "plan", label: "Updating the plan document" };
    case "create_mockup":
      return { kind: "mockup", label: `Creating mockup: ${String(input.caption ?? "")}` };
    default:
      return { kind: "code", label: name };
  }
}

async function runTool(
  name: string,
  input: Record<string, unknown>,
  planId: string
): Promise<string> {
  const provider = getSourceControl();
  switch (name) {
    case "list_repo_files": {
      const entries = await provider.listFiles(String(input.path ?? ""));
      return entries.map((e) => `${e.type === "dir" ? "dir " : "file"} ${e.path}`).join("\n") || "(empty)";
    }
    case "read_repo_file": {
      const content = await provider.readFile(String(input.path));
      return content.length > FILE_BUDGET
        ? `${content.slice(0, FILE_BUDGET)}\n\n[...clipped at ${FILE_BUDGET} chars]`
        : content;
    }
    case "search_code": {
      const hits = await provider.search(String(input.query));
      if (!hits.length) return "No matches.";
      return hits
        .map((h) => `${h.path}${h.fragments.length ? `\n  ${h.fragments.join("\n  ").slice(0, 500)}` : ""}`)
        .join("\n");
    }
    case "update_plan": {
      const plan = await db.query.plans.findFirst({
        where: eq(schema.plans.id, planId),
      });
      if (!plan) return "Plan not found.";
      const sections = {
        ...plan.sections,
        ...((input.sections as Record<string, string>) ?? {}),
      };
      await db
        .update(schema.plans)
        .set({
          ...(typeof input.title === "string" && input.title.trim()
            ? { title: input.title.trim() }
            : {}),
          sections,
          ...(Array.isArray(input.citations)
            ? { citations: (input.citations as string[]).map(String) }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.plans.id, planId));
      return "Plan updated.";
    }
    case "create_mockup": {
      await db.insert(schema.mockups).values({
        planId,
        caption: String(input.caption ?? "Mockup"),
        html: String(input.html ?? ""),
      });
      return "Mockup attached to the plan.";
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: PlanChatRequest;
  try {
    body = (await req.json()) as PlanChatRequest;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.planId || !body.message?.trim()) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const plan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, body.planId),
    with: { department: true, mockups: true },
  });
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 404 });
  if (!(await canAccessDepartment(session, plan.departmentId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (plan.status !== "draft" && plan.status !== "changes_requested") {
    return NextResponse.json(
      { error: `This plan is ${plan.status} - only draft or changes_requested plans can be edited` },
      { status: 409 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      reply:
        "The plan builder isn't available in this environment (no Anthropic API key is configured).",
    });
  }

  const history = (body.history ?? [])
    .filter((t) => t.role === "user" || t.role === "assistant")
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: String(t.content) }));

  const userEmail = session.user.email;
  const userName = session.user.name ?? session.user.email;

  // Stream NDJSON events so the manager watches the exploration live:
  // {type:"activity"} per tool call, then {type:"done"} with the reply + plan.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        send({ type: "activity", kind: "context", label: "Loading the breadth maps (canons, SOP indexes, software, company profile)" });

        const system: Anthropic.TextBlockParam[] = [
          { type: "text", text: identityBlock(plan.department.name, userName) },
          {
            type: "text",
            text: await buildPlanBreadthBlock(),
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: buildPlanStateBlock({
              title: plan.title,
              sections: plan.sections,
              citations: plan.citations,
              mockupCaptions: plan.mockups.map((m) => m.caption),
            }),
          },
        ];

        const messages: Anthropic.MessageParam[] = [
          ...history,
          { role: "user", content: body.message },
        ];

        const client = new Anthropic();
        const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
        let reply = "";

        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          send({ type: "activity", kind: "think", label: "Thinking" });
          const response = await client.messages.create({
            model,
            max_tokens: 8192,
            system,
            messages,
            tools: TOOLS,
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
          if (round === MAX_TOOL_ROUNDS) {
            reply = reply || "I ran out of exploration budget this turn - ask me to continue.";
            break;
          }

          messages.push({ role: "assistant", content: response.content });
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const use of toolUses) {
            const input = use.input as Record<string, unknown>;
            send({ type: "activity", ...describeTool(use.name, input) });
            let result: string;
            let isError = false;
            try {
              result = await runTool(use.name, input, plan.id);
            } catch (e) {
              result = `Tool failed: ${(e as Error).message}`;
              isError = true;
            }
            results.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: result,
              ...(isError ? { is_error: true } : {}),
            });
          }
          messages.push({ role: "user", content: results });
        }

        // Persist the audit transcript (chat text only - the tool traffic is
        // reproducible from the plan/mockup rows it produced).
        const existing = await db.query.planSessions.findFirst({
          where: eq(schema.planSessions.planId, plan.id),
        });
        const newTurns = [
          { role: "user", content: body.message, author: userEmail },
          { role: "assistant", content: reply },
        ];
        if (existing) {
          await db
            .update(schema.planSessions)
            .set({
              transcript: [...(existing.transcript as unknown[]), ...newTurns],
              updatedAt: new Date(),
            })
            .where(eq(schema.planSessions.id, existing.id));
        } else {
          await db
            .insert(schema.planSessions)
            .values({ planId: plan.id, transcript: newTurns });
        }

        const updated = await db.query.plans.findFirst({
          where: eq(schema.plans.id, plan.id),
          with: { mockups: true },
        });

        send({
          type: "done",
          reply: reply || "(no reply)",
          plan: updated && {
            title: updated.title,
            sections: updated.sections,
            citations: updated.citations,
            mockups: updated.mockups.map((m) => ({ id: m.id, caption: m.caption })),
          },
        });
      } catch (e) {
        send({ type: "error", error: `Claude call failed: ${(e as Error).message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
