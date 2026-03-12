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

  const titleMap = buildTitleMapFromCorpus();
  const sessionsWithTitle = sessions.map((s) => ({
    ...s,
    title: titleMap.get(s.session_id) ?? s.title,
  }));

  return Response.json({ sessions: sessionsWithTitle });
}
