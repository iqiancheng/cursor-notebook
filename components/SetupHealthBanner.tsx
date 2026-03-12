"use client";

import { useEffect, useState } from "react";

type SetupHealth = {
  eventsPath: string;
  eventsFileExists: boolean;
  eventsFileSize: number;
  hasRecentEvent: boolean;
  lastEventTimestamp: string | null;
};

export function SetupHealthBanner() {
  const [data, setData] = useState<SetupHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch("/api/setup-health");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as SetupHealth;
        if (!cancelled) {
          setData(json);
        }
      } catch (e) {
        if (!cancelled) {
          setError("Failed to check Cursor hooks status.");
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mb-4 rounded-xl border border-warning bg-warning/10 px-4 py-3 text-xs text-warning-content shadow-sm">
        <span className="font-medium">Setup check failed.</span>{" "}
        <span className="opacity-80">
          {error} You can still use the dashboard, but setup hints may be unavailable.
        </span>
      </div>
    );
  }

  if (!data) return null;

  const noEventsFile = !data.eventsFileExists || data.eventsFileSize === 0;

  if (noEventsFile) {
    return (
      <div className="mb-4 rounded-xl border border-base-300 bg-base-100/90 px-4 py-3 text-sm shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/60">
          Setup required
        </div>
        <p className="mt-1 text-sm font-medium text-base-content">
          Cursor hooks are not writing events yet.
        </p>
        <p className="mt-2 text-sm text-base-content/80">
          To enable live stats, install user-level hooks once and restart Cursor:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-base-900 px-3 py-2 text-xs text-base-100">
          <code>npm run setup-cursor-hooks</code>
        </pre>
        <p className="mt-2 text-xs text-base-content/60">
          This creates <code>~/.cursor/hooks.json</code> and copies helper scripts into{" "}
          <code>~/.cursor/scripts/</code>. It is safe to run multiple times.
        </p>
      </div>
    );
  }

  if (!data.hasRecentEvent) {
    return (
      <div className="mb-4 rounded-xl border border-base-300 bg-base-100/90 px-4 py-3 text-xs text-base-content/80 shadow-sm">
        Hooks seem installed, but there are no recent events. Try using Cursor (ask a question, run a tool) and then refresh this page.
      </div>
    );
  }

  return null;
}

