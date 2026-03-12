import { NextRequest } from "next/server";
import { getStats, getStatsForDate, getSameWeekdayLastWeek } from "@/lib/events";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") ?? "week") as "day" | "week" | "month";
  const compare = searchParams.get("compare") === "prevWeek";

  const stats = getStats(period);
  if (!compare || period !== "day") {
    return Response.json(stats);
  }

  const prevDate = getSameWeekdayLastWeek();
  const previous = getStatsForDate(prevDate);
  return Response.json({ ...stats, previous, prevDate });
}
