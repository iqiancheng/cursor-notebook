"use client";

import { useEffect, useState } from "react";

type Session = {
  session_id: string;
  reason?: string;
  duration_ms?: number;
  timestamp?: string;
  start?: string;
};

export function SessionTable() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((res) => setSessions(res.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl bg-base-100 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <span className="loading loading-spinner loading-sm mr-2" />
        <span className="align-middle text-sm text-base-content/70">Loading sessions…</span>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl bg-base-100 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <p className="text-sm text-base-content/70">
          No sessions yet. Make sure Cursor Hooks are configured for <code>sessionStart</code> / <code>sessionEnd</code>.
        </p>
      </div>
    );
  }

  function formatMs(ms?: number) {
    if (ms == null) return "—";
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }

  return (
    <div className="overflow-hidden rounded-xl bg-base-100 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-base-300/80 bg-base-200/80">
            <th className="p-3 text-xs font-semibold uppercase tracking-[0.14em] text-base-content/60">
              Session ID
            </th>
            <th className="p-3 text-xs font-semibold uppercase tracking-[0.14em] text-base-content/60">
              End time
            </th>
            <th className="p-3 text-xs font-semibold uppercase tracking-[0.14em] text-base-content/60">
              Duration
            </th>
            <th className="p-3 text-xs font-semibold uppercase tracking-[0.14em] text-base-content/60">
              End reason
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.session_id} className="border-b border-base-200/80 last:border-0">
              <td className="p-3 font-mono text-xs text-base-content/70">
                {s.session_id?.slice(0, 8)}…
              </td>
              <td className="p-3 text-base-content/70">
                {s.timestamp ? s.timestamp.slice(0, 19).replace("T", " ") : "—"}
              </td>
              <td className="p-3 text-base-content/70">{formatMs(s.duration_ms)}</td>
              <td className="p-3 text-base-content/70">{s.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
