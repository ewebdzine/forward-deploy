"use client";

import { useRef, useState } from "react";
import { commitSop } from "../actions";

type ChatTurn = { role: "user" | "assistant"; content: string };

export default function SopBuilder({
  departmentSlug,
  departmentName,
  initial,
}: {
  departmentSlug: string;
  departmentName: string;
  /** Present when revising an existing SOP. */
  initial?: { path: string; slug: string; title: string; markdown: string };
}) {
  const revise = Boolean(initial);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [topicSlug, setTopicSlug] = useState(initial?.slug ?? "");
  const [markdown, setMarkdown] = useState(initial?.markdown ?? "");
  const [pending, setPending] = useState<{
    title: string;
    topic_slug: string;
    markdown: string;
  } | null>(null);
  const [commitState, setCommitState] = useState<string | null>(null);
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
    setCommitState(null);
    const nextMessages: ChatTurn[] = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    scrollLog();

    try {
      const res = await fetch("/api/sop-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentSlug,
          message,
          history: messages, // chat text only - the draft rides in its own field
          draft: { title, markdown },
          revisePath: initial?.path,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.reply || "(updated the draft)" },
      ]);
      if (data.draft) setPending(data.draft);
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

  function applyPending() {
    if (!pending) return;
    setTitle(pending.title);
    if (!revise) setTopicSlug(pending.topic_slug);
    setMarkdown(pending.markdown);
    setPending(null);
  }

  async function commit() {
    setBusy(true);
    setCommitState(null);
    const result = await commitSop(departmentSlug, topicSlug, markdown);
    setCommitState(
      result.ok
        ? `Committed to ${result.path} (${result.sha.slice(0, 7)})`
        : result.error
    );
    setBusy(false);
  }

  return (
    <div className="sop-builder">
      <section className="card sop-chat">
        <h2 style={{ marginTop: 0 }}>
          {revise ? "Revise with Claude" : "Draft with Claude"}
        </h2>
        <div className="sop-chat-log" ref={logRef}>
          {messages.length === 0 && (
            <p className="muted">
              {revise
                ? "Tell me what should change in this SOP - a step that moved, a new tool, a pain point worth adding."
                : "Describe a process your department runs - I'll ask questions, then draft the SOP on the right. One process per SOP; we can do several in a row."}
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`sop-msg sop-msg-${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && <div className="sop-msg sop-msg-assistant muted">thinking...</div>}
        </div>
        {pending && (
          <div className="sop-draft-bar">
            <span>
              Draft ready: <strong>{pending.title}</strong>
            </span>
            <button type="button" onClick={applyPending}>
              Apply to editor
            </button>
          </div>
        )}
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
        <h2 style={{ marginTop: 0 }}>SOP draft</h2>
        <div className="row">
          <div className="stack" style={{ flex: 1 }}>
            <label htmlFor="sopTitle">Title</label>
            <input
              id="sopTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. QuickBooks invoicing"
            />
          </div>
          <div className="stack">
            <label htmlFor="sopSlug">Filename</label>
            <input
              id="sopSlug"
              value={topicSlug}
              onChange={(e) => setTopicSlug(e.target.value)}
              placeholder="quickbooks-invoicing"
              disabled={revise}
            />
          </div>
        </div>
        <textarea
          className="sop-markdown"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder={`---\ndepartment: ${departmentName}\n...\n---\n\n## What this covers\n...`}
          spellCheck={false}
        />
        <div className="row">
          <button type="button" onClick={commit} disabled={busy || !markdown.trim() || !topicSlug}>
            Commit to repo
          </button>
          {commitState && <span className="muted">{commitState}</span>}
        </div>
      </section>
    </div>
  );
}
