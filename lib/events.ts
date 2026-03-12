import fs from "fs";
import path from "path";
import os from "os";

const defaultEventsPath = path.join(
  os.platform() === "win32" ? process.env.USERPROFILE || os.homedir() : process.env.HOME || os.homedir(),
  "cursor-events.jsonl"
);
const defaultCorpusPath = path.join(
  os.platform() === "win32" ? process.env.USERPROFILE || os.homedir() : process.env.HOME || os.homedir(),
  "thinking-corpus.jsonl"
);

export function getEventsPath(): string {
  return process.env.EVENTS_JSONL_PATH || defaultEventsPath;
}

export function getCorpusPath(): string {
  return process.env.CORPUS_JSONL_PATH || defaultCorpusPath;
}

export type CursorEvent = {
  event_type: string;
  timestamp: string;
  conversation_id: string | null;
  model?: string | null;
  source?: string;
  [key: string]: unknown;
};

function readEventsLines(filePath: string): CursorEvent[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);
  const out: CursorEvent[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as CursorEvent);
    } catch {
      // skip invalid lines
    }
  }
  return out;
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

// -------- Optional history import (exported Cursor chat JSON / JSONL) --------

let historyEventsCache: CursorEvent[] | null = null;
let historyTitlesByConversationId: Record<string, string> | null = null;

function getHistoryJsonPath(): string | undefined {
  const p = process.env.CURSOR_HISTORY_JSON_PATH;
  if (!p) return undefined;
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

function parseHistoryFile(filePath: string): unknown[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.trim()) return [];
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
  } catch {
    // fall back to JSONL
  }
  const out: unknown[] = [];
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip
    }
  }
  return out;
}

function normalizeConversationId(conv: any): string {
  return (
    conv?.conversationId ||
    conv?.id ||
    conv?.sessionId ||
    conv?.session_id ||
    conv?.uuid ||
    ""
  );
}

function normalizeTimestamp(value: any, fallback: string): string {
  if (typeof value === "string" && value.includes("T")) return value;
  if (typeof value === "number") {
    try {
      return new Date(value).toISOString();
    } catch {
      return fallback;
    }
  }
  if (typeof value === "string") {
    const t = new Date(value);
    if (!Number.isNaN(t.getTime())) return t.toISOString();
  }
  return fallback;
}

function buildHistoryEvents(conversations: unknown[]): CursorEvent[] {
  const out: CursorEvent[] = [];
  for (const raw of conversations) {
    const conv: any = raw;
    const cid = normalizeConversationId(conv);
    if (!cid) continue;
    const messages: any[] = Array.isArray(conv?.messages) ? conv.messages : [];
    if (messages.length === 0) continue;

    const convModel: string | null = conv?.model || conv?.modelName || null;
    const convCreated = normalizeTimestamp(conv?.createdAt, new Date().toISOString());

    for (const msg of messages) {
      if (!msg) continue;
      const role = msg.role;
      const content = typeof msg.content === "string" ? msg.content : "";
      if (!content.trim()) continue;
      const ts = normalizeTimestamp(msg.createdAt, convCreated);

      if (role === "user") {
        out.push({
          event_type: "beforeSubmitPrompt",
          timestamp: ts,
          conversation_id: cid,
          model: convModel,
          source: "imported_history",
          prompt_length: content.length,
        });
      } else if (role === "assistant") {
        out.push({
          event_type: "afterAgentResponse",
          timestamp: ts,
          conversation_id: cid,
          model: convModel,
          source: "imported_history",
          text_length: content.length,
        });
      }
    }
  }
  return out;
}

function getHistoryEvents(): CursorEvent[] {
  if (historyEventsCache) return historyEventsCache;
  const p = getHistoryJsonPath();
  if (!p) {
    historyEventsCache = [];
    historyTitlesByConversationId = {};
    return historyEventsCache;
  }
  try {
    const conversations = parseHistoryFile(p);
    const titles: Record<string, string> = {};
    for (const raw of conversations) {
      const conv: any = raw;
      const cid = normalizeConversationId(conv);
      const title = typeof conv?.title === "string" ? conv.title.trim() : "";
      if (cid && title) titles[cid] = title;
    }
    historyTitlesByConversationId = titles;
    historyEventsCache = buildHistoryEvents(conversations);
  } catch {
    historyEventsCache = [];
    historyTitlesByConversationId = {};
  }
  return historyEventsCache;
}

export function getConversationTitle(conversationId: string | null | undefined): string | undefined {
  if (!conversationId) return undefined;
  if (!historyTitlesByConversationId) {
    void getHistoryEvents();
  }
  return historyTitlesByConversationId?.[conversationId] || undefined;
}

function getAllEvents(): CursorEvent[] {
  const base = readEventsLines(getEventsPath());
  const history = getHistoryEvents();
  if (!history.length) return base;
  return base.concat(history).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function getEvents(from?: string, to?: string, eventType?: string): CursorEvent[] {
  let events = getAllEvents();
  if (from) events = events.filter((e) => toDateKey(e.timestamp) >= from);
  if (to) events = events.filter((e) => toDateKey(e.timestamp) <= to);
  if (eventType) events = events.filter((e) => e.event_type === eventType);
  return events;
}

export function aggregateByDay(events: CursorEvent[]): Record<string, Record<string, number>> {
  const byDay: Record<string, Record<string, number>> = {};
  for (const e of events) {
    const day = toDateKey(e.timestamp);
    if (!byDay[day]) byDay[day] = {};
    const type = e.event_type;
    byDay[day][type] = (byDay[day][type] || 0) + 1;
  }
  return byDay;
}

export function getStats(period: "day" | "week" | "month") {
  const events = getAllEvents();
  const now = new Date();
  let from: string;
  if (period === "day") {
    from = now.toISOString().slice(0, 10);
  } else if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    from = d.toISOString().slice(0, 10);
  } else {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    from = d.toISOString().slice(0, 10);
  }
  const to = now.toISOString().slice(0, 10);
  const filtered = events.filter((e) => {
    const d = toDateKey(e.timestamp);
    return d >= from && d <= to;
  });

  const prompts = filtered.filter((e) => e.event_type === "beforeSubmitPrompt").length;
  const toolCalls = filtered.filter((e) => e.event_type === "postToolUse").length;
  const sessions = filtered.filter((e) => e.event_type === "sessionStart").length;
  const thoughts = filtered.filter((e) => e.event_type === "afterAgentThought").length;
  const fileEdits = filtered.filter((e) => e.event_type === "afterFileEdit").length;

  let contextTokens = 0;
  const preCompacts = filtered.filter((e) => e.event_type === "preCompact");
  for (const p of preCompacts) {
    contextTokens += Number((p as { context_tokens?: number }).context_tokens) || 0;
  }

  return {
    prompts,
    toolCalls,
    sessions,
    thoughts,
    fileEdits,
    contextTokens,
    byDay: aggregateByDay(filtered),
  };
}

export function getStatsForDate(dateStr: string) {
  const events = getAllEvents();
  const filtered = events.filter((e) => toDateKey(e.timestamp) === dateStr);
  const prompts = filtered.filter((e) => e.event_type === "beforeSubmitPrompt").length;
  const toolCalls = filtered.filter((e) => e.event_type === "postToolUse").length;
  const sessions = filtered.filter((e) => e.event_type === "sessionStart").length;
  const thoughts = filtered.filter((e) => e.event_type === "afterAgentThought").length;
  const fileEdits = filtered.filter((e) => e.event_type === "afterFileEdit").length;
  return { prompts, toolCalls, sessions, thoughts, fileEdits };
}

export function getSameWeekdayLastWeek(): string {
  const now = new Date();
  const d = new Date(now);
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export function getStatsPrevWeek() {
  const now = new Date();
  const to = new Date(now);
  to.setDate(to.getDate() - 8);
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const events = getAllEvents();
  const filtered = events.filter((e) => {
    const d = toDateKey(e.timestamp);
    return d >= fromStr && d <= toStr;
  });

  return {
    prompts: filtered.filter((e) => e.event_type === "beforeSubmitPrompt").length,
    toolCalls: filtered.filter((e) => e.event_type === "postToolUse").length,
    sessions: filtered.filter((e) => e.event_type === "sessionStart").length,
    thoughts: filtered.filter((e) => e.event_type === "afterAgentThought").length,
    fileEdits: filtered.filter((e) => e.event_type === "afterFileEdit").length,
  };
}

