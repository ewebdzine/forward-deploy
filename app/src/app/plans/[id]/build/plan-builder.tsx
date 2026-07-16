"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  PLAN_SECTIONS,
  filledSectionCount,
  parseOpenQuestionsDetailed,
} from "@/lib/plan-sections";
import ActivityIcon from "@/components/activity-icon";

type ChatTurn = { role: "user" | "assistant"; content: string };

type PlanState = {
  title: string;
  sections: Record<string, string>;
  citations: string[];
  mockups: { id: string; caption: string }[];
  resolvedQuestions: number;
};

const filledCount = filledSectionCount;

type Activity = { kind: string; label: string };

export default function PlanBuilder({
  planId,
  departmentName,
  initial,
  initialMessages = [],
}: {
  planId: string;
  departmentName: string;
  initial: PlanState;
  initialMessages?: ChatTurn[];
}) {
  const [messages, setMessages] = useState<ChatTurn[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlanState>(initial);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [justCleared, setJustCleared] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollLog() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function send(preset?: string) {
    const message = (preset ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    const nextMessages: ChatTurn[] = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    scrollLog();

    setActivities([]);
    try {
      const res = await fetch("/api/plan-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, message, history: messages }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      // NDJSON stream: activity events as Claude explores, then done/error.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "activity") {
            setActivities((prev) =>
              // Collapse consecutive "Thinking" ticks into one.
              event.kind === "think" && prev[prev.length - 1]?.kind === "think"
                ? prev
                : [...prev, { kind: event.kind, label: event.label }]
            );
            scrollLog();
          } else if (event.type === "done") {
            setMessages([
              ...nextMessages,
              { role: "assistant", content: event.reply },
            ]);
            if (event.plan) {
              const hadSections = filledCount(plan.sections) > 0;
              const hadManagerQs = parseOpenQuestionsDetailed(
                plan.sections
              ).some((q) => q.audience === "manager");
              const hasManagerQs = parseOpenQuestionsDetailed(
                event.plan.sections
              ).some((q) => q.audience === "manager");
              setPlan(event.plan);
              if (!hadSections && filledCount(event.plan.sections) > 0) {
                setDrawerOpen(true);
              }
              // The moment the manager's last question is answered: celebrate.
              if (hadManagerQs && !hasManagerQs && event.plan.resolvedQuestions > 0) {
                setJustCleared(true);
              }
            }
            finished = true;
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
      if (!finished) throw new Error("The connection ended before the reply arrived - ask me to continue.");
    } catch (e) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: `Something went wrong: ${(e as Error).message}` },
      ]);
    } finally {
      setBusy(false);
      setActivities([]);
      scrollLog();
    }
  }

  const filled = filledCount(plan.sections);
  const openQuestions = parseOpenQuestionsDetailed(plan.sections);
  const managerQs = openQuestions.filter((q) => q.audience === "manager").length;
  const devQs = openQuestions.length - managerQs;
  const totalQs = plan.resolvedQuestions + openQuestions.length;
  const ready = managerQs === 0 && totalQs > 0;

  function answerQuestion(question: string) {
    const reply = (replies[question] ?? "").trim();
    if (!reply || busy) return;
    setReplies((r) => ({ ...r, [question]: "" }));
    send(`Answering this open question: "${question}"\n\nMy answer: ${reply}`);
  }

  return (
    <div className="chat-page">
      <div className="chat-title">
        <p className="muted" style={{ margin: 0 }}>
          <Link href={`/plans/${planId}`}>&larr; plan overview</Link> - {departmentName}
        </p>
        <h1>{plan.title}</h1>
        <p className="muted" style={{ margin: 0 }}>
          Describe the inefficiency or the idea. I&apos;ll ask questions, check
          the codebase and other departments, and build the plan document as we
          go - nothing reaches the dev team until you submit.
        </p>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {openQuestions.length > 0 && !busy && (
            <div className="oq-card">
              <div className="oq-head">
                Open questions on this plan ({openQuestions.length})
                {managerQs > 0 && (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() =>
                      send(
                        "Let's work through the open questions on this plan - ask me the most important one first, one at a time."
                      )
                    }
                  >
                    Work through them
                  </button>
                )}
              </div>
              {devQs > 0 && (
                <p className="oq-explainer">
                  <span className="tag-chip oq-chip-dev">dev team</span> items
                  in yellow are implementation details the developers will
                  settle during review - you don't need to answer them.
                  {managerQs > 0 && (
                    <>
                      {" "}
                      <span className="tag-chip oq-chip-you">for you</span>{" "}
                      items in orange are waiting on your answer.
                    </>
                  )}
                </p>
              )}
              <div className="oq-list">
                {[...openQuestions]
                  .sort((a, b) =>
                    a.audience === b.audience ? 0 : a.audience === "manager" ? -1 : 1
                  )
                  .map((q) => (
                  <div
                    className={`oq-qcard ${q.audience === "dev" ? "oq-dev" : "oq-you"}`}
                    key={q.text}
                  >
                    <p className="oq-question">
                      {q.text}{" "}
                      {q.audience === "dev" ? (
                        <span className="tag-chip oq-chip-dev">dev team</span>
                      ) : (
                        <span className="tag-chip oq-chip-you">for you</span>
                      )}
                    </p>
                    <div className="oq-reply">
                      <textarea
                        rows={1}
                        value={replies[q.text] ?? ""}
                        placeholder={
                          q.audience === "dev"
                            ? "For the dev team - add input only if you have it..."
                            : "Type your answer... (Enter to send)"
                        }
                        onChange={(e) => {
                          setReplies((r) => ({ ...r, [q.text]: e.target.value }));
                          // Grow with the content (capped by CSS max-height).
                          e.target.style.height = "auto";
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            answerQuestion(q.text);
                          }
                        }}
                        disabled={busy}
                      />
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => answerQuestion(q.text)}
                        disabled={busy || !(replies[q.text] ?? "").trim()}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="msg msg-assistant msg-md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {m.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div key={i} className="msg msg-user">
                {m.content}
              </div>
            )
          )}
          {ready && !busy && (
            <div className={`ready-banner${justCleared ? " pop" : ""}`}>
              <span className="ready-check">&#10003;</span>
              <div>
                <strong>All your questions are answered.</strong>
                <p className="muted" style={{ margin: "0.15rem 0 0" }}>
                  {plan.resolvedQuestions} answered
                  {devQs > 0 &&
                    ` - ${devQs} remaining item${devQs === 1 ? " is" : "s are"} flagged for the dev team to decide during review`}
                  . This plan is ready to submit.
                </p>
              </div>
              <Link href={`/plans/${planId}`}>
                <button type="button">Review &amp; submit</button>
              </Link>
            </div>
          )}
          {busy && (
            <div className="msg msg-assistant activity-feed">
              <div>
                <span className="typing-dots">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              {activities.slice(-6).map((a, i, shown) => (
                <div
                  key={`${activities.length}-${i}`}
                  className={`activity-line${i === shown.length - 1 ? " current" : ""}`}
                >
                  <ActivityIcon kind={a.kind} /> {a.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="composer">
        <div className="composer-inner">
          <textarea
            value={input}
            placeholder="What hurts, and what do you wish happened instead? (Enter to send)"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={busy}
          />
          <div className="composer-foot">
            <span style={{ display: "inline-flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="draft-chip draft-chip-muted"
                onClick={() => setDrawerOpen(true)}
              >
                <ActivityIcon kind="sop" /> Plan document - {filled}/{PLAN_SECTIONS.length} sections
                {plan.mockups.length > 0 && ` - ${plan.mockups.length} mockup${plan.mockups.length === 1 ? "" : "s"}`}
              </button>
              {totalQs > 0 && (
                <button
                  type="button"
                  className={`draft-chip ${managerQs > 0 ? "draft-chip-warn" : "draft-chip-done"}`}
                  onClick={() =>
                    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
                  }
                >
                  {managerQs > 0
                    ? `${managerQs} for you - ${plan.resolvedQuestions} of ${totalQs} answered`
                    : `All your questions answered${devQs > 0 ? ` - ${devQs} for the dev team` : ""}`}
                </button>
              )}
            </span>
            <button type="button" onClick={() => send()} disabled={busy || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>

      <div
        className={`drawer-overlay${drawerOpen ? " open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`drawer${drawerOpen ? " open" : ""}`} aria-hidden={!drawerOpen}>
        <div className="drawer-head">
          <h2>{plan.title}</h2>
          <button
            type="button"
            className="link-button"
            onClick={() => setDrawerOpen(false)}
          >
            Close
          </button>
        </div>
        <div className="drawer-body">
          <div className="plan-doc">
            {PLAN_SECTIONS.map((s) => {
              const body = (plan.sections[s.key] ?? "").trim();
              return (
                <details key={s.key} open={Boolean(body)} className="plan-section">
                  <summary>
                    {s.label}
                    {!body && <span className="muted"> - empty</span>}
                  </summary>
                  {body ? (
                    <div className="sop-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="muted">{s.hint}</p>
                  )}
                </details>
              );
            })}
          </div>
          {plan.mockups.length > 0 && (
            <p className="muted">
              Mockups: {plan.mockups.map((m) => m.caption).join("; ")} -{" "}
              <Link href={`/plans/${planId}`}>preview on the plan page</Link>
            </p>
          )}
          {plan.citations.length > 0 && (
            <p className="muted">Citations: {plan.citations.join("; ")}</p>
          )}
        </div>
        <div className="drawer-foot">
          <Link href={`/plans/${planId}`}>
            <button type="button">Review &amp; submit</button>
          </Link>
          <span className="muted">
            {filled}/{PLAN_SECTIONS.length} sections drafted
          </span>
        </div>
      </aside>
    </div>
  );
}
