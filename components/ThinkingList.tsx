"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSearchParams } from "next/navigation";

type ThinkingRecord = {
  text: string;
  timestamp: string;
  model: string;
  conversation_id: string;
  generation_id: string;
  duration_ms: number;
};

type ThinkingGroup = {
  user_prompt?: string;
  prompt_timestamp?: string;
  conversation_id: string;
  items: ThinkingRecord[];
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyHighlightMarkdown(text: string, highlight: string): string {
  if (!highlight) return text;
  const pattern = new RegExp(`(${escapeRegExp(highlight)})`, "gi");
  return text.replace(pattern, "**$1**");
}

function stripMarkdownForTTS(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")       // fenced code blocks
    .replace(/^#{1,6}\s+/gm, "")          // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1")    // bold
    .replace(/\*([^*]+)\*/g, "$1")        // italic
    .replace(/__([^_]+)__/g, "$1")        // bold alt
    .replace(/_([^_]+)_/g, "$1")          // italic alt
    .replace(/`([^`]+)`/g, "$1")          // inline code
    .replace(/~~([^~]+)~~/g, "$1")        // strikethrough
    .replace(/^\s*[-*+]\s+/gm, "")        // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, "")        // ordered list markers
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links & images
    .replace(/^\s*>\s?/gm, "")            // blockquote markers
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function useTTS() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
    utterRef.current = null;
  }, []);

  const speak = useCallback((id: string, text: string) => {
    if (speakingId === id) {
      stop();
      return;
    }
    window.speechSynthesis.cancel();

    const plain = stripMarkdownForTTS(text);
    const utter = new SpeechSynthesisUtterance(plain);
    utter.lang = "en-US";
    utter.onend = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);

    utterRef.current = utter;
    setSpeakingId(id);
    window.speechSynthesis.speak(utter);
  }, [speakingId, stop]);

  useEffect(() => {
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  return { speakingId, speak, stop };
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-base-300 px-1.5 py-0.5 text-sm">{children}</code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-2 overflow-x-auto rounded bg-base-300 p-3 text-sm">{children}</pre>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-primary">{children}</strong>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="link link-primary">
      {children}
    </a>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-2 mt-3 text-lg font-semibold">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-2 mt-3 text-base font-semibold">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 mt-2 text-sm font-semibold">{children}</h3>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-base-300 pl-3 opacity-70">
      {children}
    </blockquote>
  ),
};

function extractTitleFromText(text: string, maxLen = 80): string {
  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? "";
  const stripped = firstLine
    .replace(/^#+\s*/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
  if (!stripped) return "Thinking…";
  return stripped.length > maxLen ? `${stripped.slice(0, maxLen)}…` : stripped;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms >= 60_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const s = ms / 1000;
  return s >= 10 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`;
}

function thinkingMeta(record: ThinkingRecord, index: number): string {
  const time = record.timestamp.slice(0, 19).replace("T", " ");
  const rawModel = record.model?.trim();
  const model = !rawModel || rawModel.toLowerCase() === "default" ? "Auto" : rawModel;
  return `#${index + 1} · ${time} · ${model} · ${formatDuration(record.duration_ms)}`;
}

function PlayButton({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={playing ? "Stop reading aloud" : "Read reasoning in English"}
      className="btn btn-circle btn-ghost btn-sm"
    >
      {playing ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

function ThinkingItem({
  record,
  index,
  accordionName,
  defaultOpen,
  playing,
  onTogglePlay,
  highlight,
}: {
  record: ThinkingRecord;
  index: number;
  accordionName: string;
  defaultOpen: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  highlight: string;
}) {
  const text = record.text.trim();
  const title = extractTitleFromText(text);
  const meta = thinkingMeta(record, index);
  const lines = text.split(/\r?\n/);
  const bodyText = lines.length > 1 ? lines.slice(1).join("\n").trim() : "";

  return (
    <div className="collapse collapse-arrow rounded-lg bg-base-100 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
      <input
        type="radio"
        name={accordionName}
        defaultChecked={defaultOpen}
      />
      <div className="collapse-title min-h-0 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-base-content/50">{meta}</span>
          <span className="font-semibold text-sm text-primary">{title}</span>
        </div>
      </div>
      <div className="collapse-content relative text-sm pr-12">
        <div className="pt-1 break-words">
          {bodyText ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {applyHighlightMarkdown(bodyText, highlight)}
            </ReactMarkdown>
          ) : null}
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="tooltip tooltip-left" data-tip="Click to read aloud in English">
            <PlayButton playing={playing} onClick={onTogglePlay} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  groupIndex,
  speakingId,
  onSpeak,
  highlight,
}: {
  group: ThinkingGroup;
  groupIndex: number;
  speakingId: string | null;
  onSpeak: (id: string, text: string) => void;
  highlight: string;
}) {
  const accordionName = `thinking-accordion-${groupIndex}`;
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const prompt = (group.user_prompt ?? "").trim();
  const isLongPrompt = prompt.length > 200;

  return (
    <li className="relative p-4 pl-7">
      <span className="pointer-events-none absolute left-2 top-4 bottom-0 w-px bg-base-300/50" />
      <span className="pointer-events-none absolute left-[5px] top-4 h-2.5 w-2.5 rounded-full border-2 border-base-100 bg-primary shadow-sm" />
      {prompt && (
        <div className="mb-3 rounded-lg bg-primary/5 px-3 py-2 ring-1 ring-primary/20">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="block text-xs font-medium uppercase tracking-wider text-primary/80">
            </span>
            {isLongPrompt && (
              <button
                type="button"
                className="btn btn-ghost btn-xs px-1 text-[11px]"
                onClick={() => setShowFullPrompt((v) => !v)}
              >
                {showFullPrompt ? "Collapse" : "Expand"}
              </button>
            )}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm">
            {showFullPrompt || !isLongPrompt ? prompt : `${prompt.slice(0, 200)}...`}
          </p>
        </div>
      )}

      <span className="mb-2 block text-xs font-medium text-success">
        Thinking ({group.items.length} items)
      </span>
      <div className="space-y-2">
        {group.items.map((r, i) => {
          const itemId = `${r.generation_id}-${i}`;
          return (
            <ThinkingItem
              key={itemId}
              record={r}
              index={i}
              accordionName={accordionName}
              defaultOpen={groupIndex === 0 && i === 0}
              playing={speakingId === itemId}
              onTogglePlay={() => onSpeak(itemId, r.text.trim())}
              highlight={highlight}
            />
          );
        })}
      </div>
    </li>
  );
}

export function ThinkingList() {
  const [groups, setGroups] = useState<ThinkingGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;
  const { speakingId, speak } = useTTS();
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight")?.toLowerCase().trim() || "";

  useEffect(() => {
    setLoading(true);
    const url = new URL("/api/thinking", window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    if (highlight) {
      url.searchParams.set("highlight", highlight);
    }
    fetch(url.toString())
      .then((r) => r.json())
      .then((res) => {
        setGroups(res.groups ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [page, highlight]);

  const visibleGroups = useMemo(() => {
    if (!highlight) return groups;
    const q = highlight.toLowerCase();
    return groups.filter((g) => {
      if (g.user_prompt && g.user_prompt.trim().toLowerCase().includes(q)) return true;
      return g.items.some((r) => r.text.toLowerCase().includes(q));
    });
  }, [groups, highlight]);

  if (loading && visibleGroups.length === 0) {
    return (
      <div className="rounded-xl bg-base-100 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <span className="loading loading-spinner loading-sm mr-2" />
        <span className="text-sm text-base-content/70">Loading…</span>
      </div>
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <div className="rounded-xl bg-base-100 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <p className="text-sm text-base-content/70">
          No thinking records yet. Use a thinking-enabled model (for example Claude Opus thinking) and make sure hooks are capturing data.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {highlight && (
        <div className="alert alert-info flex items-center justify-between text-sm">
          <span>
            Current highlight:
            <span className="font-mono font-semibold">{highlight}</span>
            . Only thinking records containing this text are shown.
          </span>
        </div>
      )}
      <div className="rounded-xl bg-base-100 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <ul className="space-y-3">
          {visibleGroups.map((g, i) => (
            <GroupCard
              key={`${g.conversation_id}-${g.prompt_timestamp ?? i}`}
              group={g}
              groupIndex={i}
              speakingId={speakingId}
              onSpeak={speak}
              highlight={highlight}
            />
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm opacity-60">Total {total} groups</p>
        <div className="join">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="join-item btn btn-sm"
          >
            Prev
          </button>
          <span className="join-item btn btn-sm btn-disabled">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="join-item btn btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
