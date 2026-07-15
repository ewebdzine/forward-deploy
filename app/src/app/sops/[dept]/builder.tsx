"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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
  const [hasDraft, setHasDraft] = useState(revise);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commitState, setCommitState] = useState<string | null>(null);
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
          history: messages,
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
      if (data.titleUpdate) {
        // Claude names the SOP from the first description, before any draft.
        setTitle(data.titleUpdate.title);
        if (!revise && !hasDraft) setTopicSlug(data.titleUpdate.topic_slug);
      }
      if (data.draft) {
        // The draft slides in over the page, already applied.
        setTitle(data.draft.title);
        if (!revise) setTopicSlug(data.draft.topic_slug);
        setMarkdown(data.draft.markdown);
        setHasDraft(true);
        setDrawerOpen(true);
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
    <div className="chat-page">
      <div className="chat-title">
        <p className="muted" style={{ margin: 0 }}>
          <Link href={`/sops/${departmentSlug}`}>&larr; {departmentName} SOPs</Link>
        </p>
        <h1>
          {revise ? `Revise: ${initial!.title}` : title || "New SOP"}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {revise
            ? "Tell me what should change - the updated draft slides in from the right."
            : "Describe a process your department runs. I'll ask questions; when I have enough, the draft slides in from the right. One process per SOP."}
        </p>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {messages.map((m, i) => (
            <div key={i} className={`msg msg-${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && <div className="msg msg-assistant muted">thinking...</div>}
        </div>
      </div>

      <div className="composer">
        <div className="composer-inner">
          <textarea
            value={input}
            placeholder="Describe the process... (Enter to send, Shift+Enter for a new line)"
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
            {hasDraft ? (
              <button
                type="button"
                className="draft-chip"
                onClick={() => setDrawerOpen(true)}
              >
                &#128196; {title || "SOP draft"} - view
              </button>
            ) : (
              <span className="muted" style={{ fontSize: "0.82rem" }}>
                {title ? `${departmentName} / ${title}` : departmentName}
              </span>
            )}
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
          <h2>SOP draft</h2>
          <button
            type="button"
            className="link-button"
            onClick={() => setDrawerOpen(false)}
          >
            Close
          </button>
        </div>
        <div className="drawer-body">
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
            spellCheck={false}
          />
        </div>
        <div className="drawer-foot">
          <button
            type="button"
            onClick={commit}
            disabled={busy || !markdown.trim() || !topicSlug}
          >
            Commit to repo
          </button>
          {commitState && <span className="muted">{commitState}</span>}
        </div>
      </aside>
    </div>
  );
}
