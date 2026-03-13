import { getEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = getEvents();
  const byType: Record<string, number> = {};
  for (const e of events) {
    byType[e.event_type] = (byType[e.event_type] ?? 0) + 1;
  }

  const preCompact = events.filter((e) => e.event_type === "preCompact");
  const afterFileEdit = events.filter((e) => e.event_type === "afterFileEdit");
  const sessionStarts = events.filter((e) => e.event_type === "sessionStart");

  const preCompactWithCid = preCompact.filter(
    (e) => (e.conversation_id ?? (e as { session_id?: string }).session_id)?.length
  );
  const afterFileEditWithCid = afterFileEdit.filter(
    (e) => (e.conversation_id ?? (e as { session_id?: string }).session_id)?.length
  );

  const sessionIds = new Set<string>();
  for (const e of sessionStarts) {
    const id = (e as { session_id?: string }).session_id ?? e.conversation_id ?? "";
    if (id) sessionIds.add(id);
  }
  const preCompactMatchingSession = preCompactWithCid.filter((e) => {
    const cid = e.conversation_id ?? (e as { session_id?: string }).session_id ?? "";
    return sessionIds.has(cid);
  });
  const afterFileEditMatchingSession = afterFileEditWithCid.filter((e) => {
    const cid = e.conversation_id ?? (e as { session_id?: string }).session_id ?? "";
    return sessionIds.has(cid);
  });

  const sample = (arr: typeof events, n: number) =>
    arr.slice(-n).map((e) => ({
      timestamp: e.timestamp,
      conversation_id: e.conversation_id ?? null,
      session_id: (e as { session_id?: string }).session_id ?? null,
      ...(e.event_type === "preCompact"
        ? { context_tokens: (e as { context_tokens?: number }).context_tokens }
        : {}),
      ...(e.event_type === "afterFileEdit"
        ? {
            lines_added: (e as { lines_added?: number }).lines_added,
            lines_removed: (e as { lines_removed?: number }).lines_removed,
          }
        : {}),
    }));

  return Response.json({
    event_counts: byType,
    preCompact: {
      total: preCompact.length,
      with_conversation_or_session_id: preCompactWithCid.length,
      matching_a_session: preCompactMatchingSession.length,
      sample: sample(preCompact, 3),
    },
    afterFileEdit: {
      total: afterFileEdit.length,
      with_conversation_or_session_id: afterFileEditWithCid.length,
      matching_a_session: afterFileEditMatchingSession.length,
      sample: sample(afterFileEdit, 3),
    },
    session_start_count: sessionStarts.length,
    hint: "If matching_a_session is 0 but total > 0, preCompact/afterFileEdit may not receive conversation_id from Cursor.",
  });
}
