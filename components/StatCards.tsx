"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  prompts: number;
  toolCalls: number;
  toolFailures: number;
  sessions: number;
  thoughts: number;
  fileEdits: number;
  contextTokens: number;
};

export function StatCards({ period = "week" }: { period?: "day" | "week" | "month" }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stats?period=${period}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl bg-base-100 shadow-[0_18px_45px_rgba(15,23,42,0.04)]"
          />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <p className="text-sm text-base-content/60">
        Unable to load data. Make sure EVENTS_JSONL_PATH points to ~/cursor-events.jsonl and that Cursor Hooks are capturing events.
      </p>
    );
  }

  const cards = [
    { label: "Prompts", value: stats.prompts, href: "/daily" },
    { label: "Tool calls", value: stats.toolCalls, href: "/daily" },
    { label: "Sessions", value: stats.sessions, href: "/sessions" },
    { label: "Thinking entries", value: stats.thoughts, href: "/thinking" },
    { label: "File edits", value: stats.fileEdits },
    // { label: "上下文 token 约", value: stats.contextTokens > 0 ? stats.contextTokens.toLocaleString() : "—" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map(({ label, value, href }) => (
        <div
          key={label}
          className="group rounded-xl bg-base-100 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.08)]"
        >
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-base-content/50">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-base-content">
            {href ? (
              <Link href={href} className="transition group-hover:text-primary">
                {value}
              </Link>
            ) : (
              value
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
