import { VocabStats } from "@/components/VocabStats";

export default function VocabPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-base-content">
          Vocabulary insights
        </h1>
        <p className="text-sm text-base-content/60">
          High-frequency words and phrases extracted from thinking traces, based on n-gram statistics with stopword filtering.
        </p>
      </header>
      <VocabStats />
    </main>
  );
}
