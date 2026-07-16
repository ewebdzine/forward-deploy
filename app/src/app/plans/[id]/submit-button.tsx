"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitPlan } from "../actions";

export default function SubmitPlanButton({
  planId,
  compact = false,
}: {
  planId: string;
  compact?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await submitPlan(planId);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  if (compact) {
    return (
      <span className="row">
        <button type="button" className="ready-cta" onClick={submit} disabled={busy}>
          Submit to the dev team
        </button>
        {error && <span className="badge-warn">{error}</span>}
      </span>
    );
  }

  return (
    <div className="card">
      <div className="row">
        <button type="button" onClick={submit} disabled={busy}>
          Submit to the dev team
        </button>
        <Link className="button-secondary" href={`/plans/${planId}/build`}>
          Continue building
        </Link>
        {error && <span className="badge-warn">{error}</span>}
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        Submitting moves the plan into the developers&apos; review queue. You
        can keep editing if they request changes.
      </p>
    </div>
  );
}
