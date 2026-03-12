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
  previous?: Stats;
  prevDate?: string;
};

export function StatCards({
  period = "week",
  compareWithPrevWeek = false,
}: {
  period?: "day" | "week" | "month";
  compareWithPrevWeek?: boolean;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ period });
    if (compareWithPrevWeek && (period === "day" || period === "week")) params.set("compare", "prevWeek");
    fetch(`/api/stats?${params}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [period, compareWithPrevWeek]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
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

  const prev = stats.previous;
  const cards = [
    { label: "Prompts", value: stats.prompts, href: "/daily", prevVal: prev?.prompts },
    { label: "Tool calls", value: stats.toolCalls, href: "/daily", prevVal: prev?.toolCalls },
    { label: "Sessions", value: stats.sessions, href: "/sessions", prevVal: prev?.sessions },
    { label: "Thinking entries", value: stats.thoughts, href: "/thinking", prevVal: prev?.thoughts },
    { label: "File edits", value: stats.fileEdits, prevVal: prev?.fileEdits },
  ];

  const prevDate = stats.prevDate;
  const prevLabel = period === "day" && prevDate
    ? new Date(prevDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })
    : "prev week";

  function Delta({ value, prevVal }: { value: number; prevVal?: number }) {
    if (prevVal == null) return null;
    const delta = value - prevVal;
    if (delta === 0) return <span className="text-xs text-base-content/40">= {prevLabel}</span>;
    const up = delta > 0;
    return (
      <span className={`text-xs ${up ? "text-success" : "text-base-content/50"}`}>
        {up ? "↑" : "↓"} {Math.abs(delta)} vs {prevLabel}
      </span>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map(({ label, value, href, prevVal }) => (
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
          {prevVal != null && (
            <p className="mt-1">
              <Delta value={value} prevVal={prevVal} />
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
