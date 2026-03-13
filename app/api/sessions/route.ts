import fs from "fs";
import os from "os";
import { getEvents } from "@/lib/events";

function getPromptCorpusPath(): string {
  if (process.env.PROMPT_CORPUS_PATH) return process.env.PROMPT_CORPUS_PATH;
  const isWin = os.platform() === "win32";
  const home = isWin ? process.env.USERPROFILE || os.homedir() : process.env.HOME || os.homedir();
  const sep = isWin ? "\\" : "/";
  return `${home}${sep}prompt-corpus.jsonl`;
}

function buildTitleMapFromCorpus() {
  const p = getPromptCorpusPath();
  if (!fs.existsSync(p)) return new Map<string, string>();
  const raw = fs.readFileSync(p, "utf-8").trim();
  if (!raw) return new Map<string, string>();
  const map = new Map<string, string>();
  const lines = raw.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as { conversation_id?: string; prompt?: string };
      const cid = typeof row.conversation_id === "string" ? row.conversation_id : "";
      const prompt = typeof row.prompt === "string" ? row.prompt : "";
      if (!cid || !prompt || map.has(cid)) continue;
      const firstLine = prompt.split(/\r?\n/)[0]?.trim() ?? "";
      if (!firstLine) continue;
      const title = firstLine.length > 20 ? `${firstLine.slice(0, 20)}…` : firstLine;
      map.set(cid, title);
    } catch {
      // skip invalid lines
    }
  }
  return map;
}

export async function GET() {
  const events = getEvents();
  const sessionEnds = events.filter((e) => e.event_type === "sessionEnd");
  const sessionStarts = events.filter((e) => e.event_type === "sessionStart");

  const bySessionId = new Map<
    string,
    { session_id: string; reason?: string; duration_ms?: number; timestamp?: string; start?: string; title?: string }
  >();
  const conversationIdToSessionId = new Map<string, string>();
  for (const e of sessionStarts) {
    const id = (e as { session_id?: string }).session_id ?? e.conversation_id ?? "";
    if (id) {
      if (e.conversation_id) conversationIdToSessionId.set(e.conversation_id, id);
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
      if (e.conversation_id) conversationIdToSessionId.set(e.conversation_id, id);
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

  const sessionStartById = new Map<string, string>();
  for (const e of sessionStarts) {
    const id = (e as { session_id?: string }).session_id ?? e.conversation_id ?? "";
    if (id && e.timestamp) {
      const existing = sessionStartById.get(id);
      if (!existing || e.timestamp < existing) sessionStartById.set(id, e.timestamp);
      if (e.conversation_id && e.conversation_id !== id) {
        const ex = sessionStartById.get(e.conversation_id);
        if (!ex || e.timestamp < ex) sessionStartById.set(e.conversation_id, e.timestamp);
      }
    }
  }

  const lastEventByCid = new Map<string, string>();
  for (const e of events) {
    const cid = e.conversation_id ?? (e as { session_id?: string }).session_id ?? "";
    if (!cid || !e.timestamp) continue;
    const sessionKey = conversationIdToSessionId.get(cid) ?? cid;
    if (!bySessionId.has(sessionKey)) continue;
    const cur = lastEventByCid.get(sessionKey);
    if (!cur || e.timestamp > cur) lastEventByCid.set(sessionKey, e.timestamp);
  }

  for (const [id, s] of bySessionId) {
    if (s.timestamp) continue;
    const lastTs = lastEventByCid.get(id);
    if (!lastTs) continue;
    const start = sessionStartById.get(id);
    const durationMs = start ? new Date(lastTs).getTime() - new Date(start).getTime() : undefined;
    bySessionId.set(id, {
      ...s,
      timestamp: lastTs,
      reason: s.reason ?? "no_session_end",
      duration_ms: s.duration_ms ?? (durationMs && durationMs > 0 ? durationMs : undefined),
    });
  }

  const sessions = Array.from(bySessionId.values())
    .filter((s) => s.timestamp)
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));

  const bySessionIdStats = new Map<
    string,
    { context_tokens: number; file_edits: number; lines_added: number; lines_removed: number }
  >();
  for (const e of events) {
    const cid = e.conversation_id ?? (e as { session_id?: string }).session_id ?? "";
    if (!cid) continue;
    const sessionKey = bySessionId.has(cid) ? cid : conversationIdToSessionId.get(cid) ?? "";
    if (!sessionKey || !bySessionId.has(sessionKey)) continue;
    const start = sessionStartById.get(sessionKey) ?? sessionStartById.get(cid);
    const endTs = bySessionId.get(sessionKey)?.timestamp;
    if (start && endTs && e.timestamp >= start && e.timestamp <= endTs) {
      let stats = bySessionIdStats.get(sessionKey);
      if (!stats) {
        stats = { context_tokens: 0, file_edits: 0, lines_added: 0, lines_removed: 0 };
        bySessionIdStats.set(sessionKey, stats);
      }
      if (e.event_type === "preCompact") {
        stats.context_tokens += Number((e as { context_tokens?: number }).context_tokens) || 0;
      } else if (e.event_type === "afterFileEdit") {
        const ev = e as { edits_count?: number; lines_added?: number; lines_removed?: number };
        stats.file_edits += Number(ev.edits_count) || 0;
        stats.lines_added += Number(ev.lines_added) || 0;
        stats.lines_removed += Number(ev.lines_removed) || 0;
      }
    }
  }

  const titleMap = buildTitleMapFromCorpus();
  const sessionsWithTitle = sessions.map((s) => {
    const stats = bySessionIdStats.get(s.session_id);
    return {
      ...s,
      title: titleMap.get(s.session_id) ?? s.title,
      context_tokens: stats?.context_tokens ?? 0,
      file_edits: stats?.file_edits ?? 0,
      lines_added: stats?.lines_added ?? 0,
      lines_removed: stats?.lines_removed ?? 0,
    };
  });

  return Response.json({ sessions: sessionsWithTitle });
}
