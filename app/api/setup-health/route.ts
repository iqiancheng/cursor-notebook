import fs from "fs";
import { NextResponse } from "next/server";
import { getEventsPath, getEvents } from "@/lib/events";

export async function GET() {
  const eventsPath = getEventsPath();
  const exists = fs.existsSync(eventsPath);

  let size = 0;
  let lastEventTimestamp: string | null = null;
  let hasRecentEvent = false;

  if (exists) {
    try {
      const stat = fs.statSync(eventsPath);
      size = stat.size;
      if (size > 0) {
        const events = getEvents();
        if (events.length > 0) {
          lastEventTimestamp = events[events.length - 1]!.timestamp;
          const last = new Date(lastEventTimestamp);
          const now = new Date();
          const diffMs = now.getTime() - last.getTime();
          hasRecentEvent = !Number.isNaN(last.getTime()) && diffMs < 10 * 60 * 1000;
        }
      }
    } catch {
      // ignore fs / parse errors, fall back to defaults
    }
  }

  return NextResponse.json({
    eventsPath,
    eventsFileExists: exists,
    eventsFileSize: size,
    hasRecentEvent,
    lastEventTimestamp,
  });
}

