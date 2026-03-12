import { getEvents, getConversationTitle } from "@/lib/events";

export async function GET() {
  const events = getEvents();
  const sessionEnds = events.filter((e) => e.event_type === "sessionEnd");
  const sessionStarts = events.filter((e) => e.event_type === "sessionStart");

  const bySessionId = new Map<
    string,
    { session_id: string; reason?: string; duration_ms?: number; timestamp?: string; start?: string; title?: string }
  >();
  for (const e of sessionStarts) {
    const id = (e as { session_id?: string }).session_id ?? e.conversation_id ?? "";
    if (id) {
      const prev = bySessionId.get(id);
      const eventTitle =
        (e as { title?: string; session_title?: string }).title ??
        (e as { title?: string; session_title?: string }).session_title ??
        prev?.title;
      bySessionId.set(id, {
        ...prev,
        session_id: id,
        start: prev?.start ?? e.timestamp,
        title: eventTitle,
      });
    }
  }
  for (const e of sessionEnds) {
    const id = (e as { session_id?: string }).session_id ?? e.conversation_id ?? "";
    if (id) {
      const prev = bySessionId.get(id);
      const eventTitle =
        (e as { title?: string; session_title?: string }).title ??
        (e as { title?: string; session_title?: string }).session_title ??
        prev?.title;
      bySessionId.set(id, {
        ...prev,
        session_id: id,
        reason: (e as { reason?: string }).reason ?? prev?.reason,
        duration_ms: (e as { duration_ms?: number }).duration_ms ?? prev?.duration_ms,
        timestamp: e.timestamp,
        title: eventTitle,
      });
    }
  }

  const sessions = Array.from(bySessionId.values())
    .filter((s) => s.timestamp)
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));

  const sessionsWithTitle = sessions.map((s) => ({
    ...s,
    title: getConversationTitle(s.session_id) ?? s.title,
  }));

  return Response.json({ sessions: sessionsWithTitle });
}
