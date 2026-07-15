"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PLAN_SECTIONS } from "@/lib/plan-sections";

type ChatTurn = { role: "user" | "assistant"; content: string };

type PlanState = {
  title: string;
  sections: Record<string, string>;
  citations: string[];
  mockups: { id: string; caption: string }[];
};

function filledCount(sections: Record<string, string>): number {
  return PLAN_SECTIONS.filter((s) => (sections[s.key] ?? "").trim()).length;
}

export default function PlanBuilder({
  planId,
  departmentName,
  initial,
}: {
  planId: string;
  departmentName: string;
  initial: PlanState;
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlanState>(initial);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollLog() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    const nextMessages: ChatTurn[] = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    scrollLog();

    try {
      const res = await fetch("/api/plan-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, message, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      if (data.plan) {
        const hadSections = filledCount(plan.sections) > 0;
        setPlan(data.plan);
        // First time the document takes shape, slide it in so the manager
        // sees it exists; afterwards the chip carries the running count.
        if (!hadSections && filledCount(data.plan.sections) > 0) {
          setDrawerOpen(true);
        }
      }
    } catch (e) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: `Something went wrong: ${(e as Error).message}` },
      ]);
    } finally {
      setBusy(false);
      scrollLog();
    }
  }

  const filled = filledCount(plan.sections);

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
          {messages.map((m, i) => (
            <div key={i} className={`msg msg-${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="msg msg-assistant">
              <span className="typing-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="muted" style={{ marginLeft: 8, fontSize: "0.85rem" }}>
                exploring the codebase - this can take a minute
              </span>
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
            <button
              type="button"
              className="draft-chip"
              onClick={() => setDrawerOpen(true)}
            >
              &#128203; Plan document - {filled}/{PLAN_SECTIONS.length} sections
              {plan.mockups.length > 0 && ` - ${plan.mockups.length} mockup${plan.mockups.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" onClick={send} disabled={busy || !input.trim()}>
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
