import { StatCards } from "@/components/StatCards";
import { DailyChart } from "@/components/DailyChart";

export default function DailyPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-base-content">
          Daily usage
        </h1>
        <p className="text-sm text-base-content/60">
          Today vs same weekday last week. Trend over last 30 days.
        </p>
      </header>
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-base-content/50">
          Today vs last week
        </h2>
        <StatCards period="day" compareWithPrevWeek />
      </section>
      <section>
        <DailyChart days={30} />
      </section>
    </main>
  );
}

