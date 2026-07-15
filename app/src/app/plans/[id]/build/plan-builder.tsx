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

export default function PlanBuilder({
  planId,
  initial,
}: {
  planId: string;
  initial: PlanState;
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlanState>(initial);
  const logRef = useRef<HTMLDivElement>(null);

  function scrollLog() {
    requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
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
      if (data.plan) setPlan(data.plan);
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

  return (
    <div className="sop-builder">
      <section className="card sop-chat">
        <h2 style={{ marginTop: 0 }}>Plan with Claude</h2>
        <div className="sop-chat-log" ref={logRef}>
          {messages.length === 0 && (
            <p className="muted">
              Describe the inefficiency or the idea - what happens today, what
              you wish happened instead. I&apos;ll ask questions, check what the
              codebase and other departments already have, and build the plan
              document on the right as we go.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`sop-msg sop-msg-${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="sop-msg sop-msg-assistant muted">
              exploring the codebase and drafting... (this can take a minute)
            </div>
          )}
        </div>
        <textarea
          rows={3}
          value={input}
          placeholder="Type and press Enter to send (Shift+Enter for a new line)"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={busy}
        />
      </section>

      <section className="card sop-editor">
        <h2 style={{ marginTop: 0 }}>{plan.title}</h2>
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
        <p className="muted" style={{ marginBottom: 0 }}>
          Done building? <Link href={`/plans/${planId}`}>Review &amp; submit</Link>
        </p>
      </section>
    </div>
  );
}
