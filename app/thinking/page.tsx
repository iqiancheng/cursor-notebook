import { ThinkingList } from "@/components/ThinkingList";

export default function ThinkingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-base-content">
          Thinking traces
        </h1>
        <p className="text-sm text-base-content/60">
          Reasoning traces captured from the <code>afterAgentThought</code> hook. Use a thinking-enabled model (for example Claude Opus thinking) and ensure hooks are configured.
        </p>
      </header>
      <ThinkingList />
    </main>
  );
}
