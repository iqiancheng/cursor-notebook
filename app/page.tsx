import { StatCards } from "@/components/StatCards";
import { DailyChart } from "@/components/DailyChart";
import { SetupHealthBanner } from "@/components/SetupHealthBanner";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <SetupHealthBanner />
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-base-content">
          Dashboard
        </h1>
        <p className="text-sm text-base-content/60">
          Overview of your recent Cursor usage: prompts, tool calls, sessions and thinking events. Context tokens are approximated from preCompact events.
        </p>
      </header>
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-base-content/50">
          This week vs prev week
        </h2>
        <StatCards period="week" compareWithPrevWeek />
      </section>
      <section>
        <DailyChart days={14} />
      </section>
    </main>
  );
}
