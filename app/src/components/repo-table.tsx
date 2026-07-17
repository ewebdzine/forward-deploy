"use client";

import { useState } from "react";
import Link from "next/link";
import ActivityIcon from "@/components/activity-icon";

type Entry = { name: string; path: string; type: "file" | "dir"; size?: number };

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 2 : 1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function RepoTable({
  entries,
  path,
}: {
  entries: Entry[];
  path: string;
}) {
  const [filter, setFilter] = useState("");
  const shown = filter
    ? entries.filter((e) =>
        e.name.toLowerCase().includes(filter.toLowerCase())
      )
    : entries;
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

  return (
    <>
      <div className="repo-toolbar">
        <input
          type="search"
          placeholder="Filter files..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="card repo-card">
        <table className="repo-table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ textAlign: "right" }}>Size</th>
            </tr>
          </thead>
          <tbody>
            {path && !filter && (
              <tr>
                <td colSpan={2}>
                  <Link href={`/repo?path=${encodeURIComponent(parent)}`}>
                    ..
                  </Link>
                </td>
              </tr>
            )}
            {shown.map((e) => (
              <tr key={e.path}>
                <td>
                  <span className="repo-name">
                    <ActivityIcon kind={e.type === "dir" ? "browse" : "doc"} />
                    <Link
                      href={
                        e.type === "dir"
                          ? `/repo?path=${encodeURIComponent(e.path)}`
                          : `/repo/view?path=${encodeURIComponent(e.path)}`
                      }
                    >
                      {e.name}
                    </Link>
                  </span>
                </td>
                <td className="muted" style={{ textAlign: "right" }}>
                  {e.type === "dir" ? "-" : formatSize(e.size)}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={2} className="muted">
                  No files match &quot;{filter}&quot;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
