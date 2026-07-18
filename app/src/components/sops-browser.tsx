"use client";

import { useState } from "react";
import Link from "next/link";

export type SopCard = {
  href: string;
  topic: string;
  tools: string[];
  owner: string;
  updated: string;
  band: number;
};

export type SopGroup = {
  slug: string;
  name: string;
  newHref: string;
  sops: SopCard[];
};

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function FacetRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={`filter-pill${selected.has(o) ? " active" : ""}`}
          onClick={() => onToggle(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/**
 * SOP card grid with multi-select facet filtering (within a facet: OR,
 * across facets: AND). grouped=true renders per-department sections with
 * their + New SOP action, hiding sections the filters empty out.
 */
export default function SopsBrowser({
  groups,
  grouped,
}: {
  groups: SopGroup[];
  grouped: boolean;
}) {
  const [depts, setDepts] = useState<Set<string>>(new Set());
  const [tools, setTools] = useState<Set<string>>(new Set());
  const [owners, setOwners] = useState<Set<string>>(new Set());

  const allSops = groups.flatMap((g) => g.sops);
  const toolOptions = [...new Set(allSops.flatMap((s) => s.tools))].sort();
  const ownerOptions = [...new Set(allSops.map((s) => s.owner).filter(Boolean))].sort();
  const deptOptions = groups.map((g) => g.name);

  const matches = (s: SopCard) =>
    (tools.size === 0 || s.tools.some((t) => tools.has(t))) &&
    (owners.size === 0 || owners.has(s.owner));

  const visibleGroups = groups
    .filter((g) => depts.size === 0 || depts.has(g.name))
    .map((g) => ({ ...g, sops: g.sops.filter(matches) }));

  const anyShown = visibleGroups.some((g) => g.sops.length > 0);

  const grid = (sops: SopCard[]) => (
    <div className="tile-grid">
      {sops.map((s) => (
        <Link className="tile" href={s.href} key={s.href}>
          <div className={`tile-band tile-band-slim band-${s.band % 4}`}>
            <span style={{ fontSize: "1.3rem" }}>
              {s.topic.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="tile-body">
            <span className="tile-name">{s.topic}</span>
            <span className="tile-chips">
              {s.tools.slice(0, 3).map((t) => (
                <span className="tag-chip" key={t}>
                  {t}
                </span>
              ))}
              {s.tools.length > 3 && (
                <span className="tag-chip">+{s.tools.length - 3}</span>
              )}
              {s.updated && <span className="tag-chip">{s.updated}</span>}
            </span>
            {s.owner && (
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                {s.owner}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      {grouped && (
        <FacetRow
          label="Department"
          options={deptOptions}
          selected={depts}
          onToggle={(v) => setDepts(toggle(depts, v))}
        />
      )}
      <FacetRow
        label="Software"
        options={toolOptions}
        selected={tools}
        onToggle={(v) => setTools(toggle(tools, v))}
      />
      <FacetRow
        label="Created by"
        options={ownerOptions}
        selected={owners}
        onToggle={(v) => setOwners(toggle(owners, v))}
      />

      {grouped ? (
        visibleGroups.map((g) => (
          <section key={g.slug}>
            <div className="section-head">
              <h2>
                <Link href={`/sops/${g.slug}`}>{g.name}</Link>{" "}
                <span className="muted" style={{ fontWeight: 400 }}>
                  - {g.sops.length} SOP{g.sops.length === 1 ? "" : "s"}
                </span>
              </h2>
              <Link className="button-secondary" href={g.newHref}>
                + New SOP
              </Link>
            </div>
            {g.sops.length > 0 ? (
              grid(g.sops)
            ) : (
              <div className="card">
                <p className="muted" style={{ margin: 0 }}>
                  {tools.size || owners.size
                    ? "No SOPs match the filters."
                    : "No SOPs yet - document the first process."}
                </p>
              </div>
            )}
          </section>
        ))
      ) : anyShown ? (
        grid(visibleGroups[0]?.sops ?? [])
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {tools.size || owners.size
              ? "No SOPs match the filters."
              : "No SOPs yet. Document your first process - describe it to Claude and the draft builds itself."}
          </p>
        </div>
      )}
    </>
  );
}
