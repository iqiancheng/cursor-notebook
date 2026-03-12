import { SessionTable } from "@/components/SessionTable";

export default function SessionsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-base-content">
          Sessions
        </h1>
        <p className="text-sm text-base-content/60">
          Sessions aggregated from <code>sessionStart</code> / <code>sessionEnd</code> events.
        </p>
      </header>
      <SessionTable />
    </main>
  );
}
