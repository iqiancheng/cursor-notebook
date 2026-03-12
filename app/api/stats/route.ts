import { NextRequest } from "next/server";
import { getStats, getStatsForDate, getSameWeekdayLastWeek, getStatsPrevWeek } from "@/lib/events";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") ?? "week") as "day" | "week" | "month";
  const compare = searchParams.get("compare") === "prevWeek";

  const stats = getStats(period);
  if (!compare) {
    return Response.json(stats);
  }

  if (period === "day") {
    const prevDate = getSameWeekdayLastWeek();
    const previous = getStatsForDate(prevDate);
    return Response.json({ ...stats, previous, prevDate });
  }

  if (period === "week") {
    const previous = getStatsPrevWeek();
    return Response.json({ ...stats, previous });
  }

  return Response.json(stats);
}
