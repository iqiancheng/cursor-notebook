"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const TOP_CHART = 10;
const TOP_LIST = 100;
const STORAGE_KEY = "vocab_starred_v1";

function usePrimaryColor(): string {
  const [color, setColor] = useState("hsl(217, 91%, 60%)");
  useEffect(() => {
    const update = () => {
      try {
        const p = getComputedStyle(document.documentElement).getPropertyValue("--p").trim();
        if (p) {
          const parts = p.split(/\s+/);
          if (parts.length >= 3) setColor(`hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`);
        }
      } catch {
        // fallback
      }
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return color;
}

function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () =>
      setDark(document.documentElement.getAttribute("data-theme") === "business");
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

type WordFreq = { word: string; count: number };
type PhraseFreq = { phrase: string; count: number };
type VocabData = {
  words: WordFreq[];
  phrases: PhraseFreq[];
  totalTokens: number;
  totalRecords: number;
};

type Tab = "words" | "phrases";

function BarChart({
  items,
  onBarClick,
  primaryColor = "hsl(217, 91%, 60%)",
  isDark = false,
}: {
  items: { name: string; value: number }[];
  onBarClick?: (name: string) => void;
  primaryColor?: string;
  isDark?: boolean;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ReturnType<typeof import("echarts")["init"]> | null>(null);
  const onBarClickRef = useRef(onBarClick);
  onBarClickRef.current = onBarClick;

  useEffect(() => {
    if (!chartRef.current || items.length === 0) return;
    let disposed = false;

    import("echarts").then((echarts) => {
      if (disposed || !chartRef.current) return;
      if (instanceRef.current) instanceRef.current.dispose();

      const chart = echarts.init(chartRef.current);
      instanceRef.current = chart;

      const topN = items.slice(0, 10).reverse();
      const textColor = isDark ? "#9ca3af" : "#6b7280";
      const lineColor = isDark ? "#374151" : "#e5e7eb";
      const labelColor = isDark ? "#d1d5db" : "#374151";
      const seriesColor =
        primaryColor.startsWith("hsl(")
          ? primaryColor.replace("hsl(", "hsla(").replace(")", ", 0.35)")
          : primaryColor;
      chart.setOption({
        color: [seriesColor],
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: isDark ? "rgba(30,41,59,0.95)" : "rgba(15,23,42,0.9)",
          borderWidth: 0,
          textStyle: { color: "#e5e7eb", fontSize: 12 },
        },
        grid: { left: 120, right: 30, top: 10, bottom: 30 },
        xAxis: {
          type: "value",
          axisLine: { show: false },
          axisLabel: { color: textColor, fontSize: 11 },
          splitLine: { lineStyle: { color: lineColor, type: "dashed" } },
        },
        yAxis: {
          type: "category",
          data: topN.map((d) => d.name),
          axisLabel: { fontSize: 12, color: labelColor },
        },
        series: [
          {
            type: "bar",
            data: topN.map((d) => d.value),
            itemStyle: { borderRadius: [0, 6, 6, 0] },
            emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(59,130,246,0.35)" } },
          },
        ],
      });

      chart.off("click");
      chart.on("click", (params: { componentType: string; name: string }) => {
        if (params.componentType === "series" && params.name) {
          onBarClickRef.current?.(params.name);
        }
      });

      const onResize = () => chart.resize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    });

    return () => {
      disposed = true;
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [items, primaryColor, isDark]);

  if (items.length === 0) return null;
  const chartHeight = Math.min(Math.max(400, items.length * 22), 1200);
  return <div ref={chartRef} className="w-full overflow-auto" style={{ height: chartHeight }} />;
}

function loadStarred(): { words: string[]; phrases: string[] } {
  if (typeof window === "undefined") return { words: [], phrases: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { words: [], phrases: [] };
    const parsed = JSON.parse(raw);
    return {
      words: Array.isArray(parsed?.words) ? parsed.words.filter((w: unknown): w is string => typeof w === "string") : [],
      phrases: Array.isArray(parsed?.phrases) ? parsed.phrases.filter((p: unknown): p is string => typeof p === "string") : [],
    };
  } catch {
    return { words: [], phrases: [] };
  }
}

function saveStarred(starred: { words: string[]; phrases: string[] }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(starred));
  } catch {
    // ignore
  }
}

export function VocabStats() {
  const router = useRouter();
  const primaryColor = usePrimaryColor();
  const isDark = useIsDark();
  const [data, setData] = useState<VocabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("phrases");
  const [search, setSearch] = useState("");
  const [starred, setStarred] = useState<{ words: string[]; phrases: string[] }>(loadStarred);

  useEffect(() => {
    fetch("/api/vocab?wordLimit=1000&phraseLimit=1000")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    saveStarred(starred);
  }, [starred]);

  const toggleStar = (text: string, isWord: boolean) => {
    setStarred((prev) => {
      const list = isWord ? prev.words : prev.phrases;
      const next = list.includes(text) ? list.filter((x) => x !== text) : [...list, text];
      return isWord ? { ...prev, words: next } : { ...prev, phrases: next };
    });
  };

  const starredCount = starred.words.length + starred.phrases.length;

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const items = tab === "words" ? data.words : data.phrases;
    let list = [...items].sort((a, b) => b.count - a.count);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((x) =>
        ("word" in x ? x.word : (x as PhraseFreq).phrase).toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, tab, search]);

  const chartItems = useMemo(
    () =>
      filteredItems.slice(0, TOP_CHART).map((d) => ({
        name: "word" in d ? d.word : (d as PhraseFreq).phrase,
        value: d.count,
      })),
    [filteredItems]
  );

  const listItems = useMemo(
    () =>
      filteredItems.slice(0, TOP_LIST).map((d) => ({
        name: "word" in d ? d.word : (d as PhraseFreq).phrase,
        value: d.count,
      })),
    [filteredItems]
  );

  if (loading) {
    return (
      <div className="rounded-xl bg-base-100 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <span className="loading loading-spinner loading-sm mr-2" />
        <span className="text-sm text-base-content/70">Analyzing vocabulary…</span>
      </div>
    );
  }

  if (!data || (data.words.length === 0 && data.phrases.length === 0)) {
    return (
      <div className="rounded-xl bg-base-100 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <p className="text-sm text-base-content/70">
          No data yet. Make sure there are records in thinking-corpus.jsonl.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[
          { label: "Thinking records", value: data.totalRecords },
          tab === "words"
            ? { label: "Unique words", value: data.words.length }
            : { label: "Frequent phrases", value: data.phrases.length },
          { label: "Starred", value: starredCount },
        ].map((c) => (
          <div
            key={c.label}
            className="group rounded-xl bg-base-100 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.08)]"
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-base-content/50">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-base-content">{c.value}</p>
          </div>
        ))}
      </div>

      {/* tabs + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="tabs tabs-bordered">
          <button
            type="button"
            role="tab"
            className={`tab ${tab === "phrases" ? "tab-active" : ""}`}
            onClick={() => setTab("phrases")}
          >
            Phrase
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${tab === "words" ? "tab-active" : ""}`}
            onClick={() => setTab("words")}
          >
            Word
          </button>
        </div>
        <input
          type="text"
          placeholder={tab === "words" ? "Search words…" : "Search phrases…"}
          className="input input-sm w-full max-w-xs rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm transition-colors placeholder:text-base-content/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* chart */}
      <div className="rounded-xl bg-base-100 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <p className="mb-2 text-sm text-base-content/70">
          Top {TOP_CHART} · <span className="text-primary font-medium">Click a bar to open in Thinking</span>
        </p>
        {chartItems.length === 0 ? (
          <div className="flex min-h-[min(300px,40vh)] flex-col items-center justify-center rounded-lg border border-dashed border-base-300 py-12 text-center">
            <p className="text-sm text-base-content/60">
              {search.trim() ? "No matching results" : "No data for this tab"}
            </p>
          </div>
        ) : (
          <div className="cursor-pointer">
            <BarChart
              items={chartItems}
              primaryColor={primaryColor}
              isDark={isDark}
              onBarClick={(name) => router.push(`/thinking?highlight=${encodeURIComponent(name)}`)}
            />
          </div>
        )}
      </div>

      {/* Top 100 list with star buttons */}
      {listItems.length > 0 && (
        <div className="rounded-xl bg-base-100 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-base-content/50">
            Top {TOP_LIST} · Click to open in Thinking, star to save
          </p>
          <div className="flex flex-wrap gap-2">
            {listItems.map((item) => {
              const text = item.name;
              const isWord = tab === "words";
              const isStarred = isWord ? starred.words.includes(text) : starred.phrases.includes(text);
              return (
                <div
                  key={text}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                    isStarred ? "bg-primary/10 ring-1 ring-primary/30" : "bg-base-200/80 hover:bg-base-300/80"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleStar(text, isWord)}
                    className="btn btn-ghost btn-xs px-1"
                    aria-label={isStarred ? "Unstar" : "Star"}
                  >
                    {isStarred ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-warning">
                        <path d="M12 2.25l2.955 6.016 6.645.967-4.8 4.68 1.133 6.617L12 17.75l-5.933 3.12 1.133-6.617-4.8-4.68 6.645-.967L12 2.25z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                        <path d="M12 2.75l2.7 5.5 6.05.88-4.375 4.27 1.033 6.02L12 16.96l-5.408 2.91 1.033-6.02L3.25 9.13l6.05-.88L12 2.75z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/thinking?highlight=${encodeURIComponent(text)}`)}
                    className="flex-1 text-left font-medium hover:text-primary"
                  >
                    {text}
                  </button>
                  <span className="text-xs text-base-content/50">{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Starred section */}
      {starredCount > 0 && (
        <div className="rounded-xl bg-base-100 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-base-content/50">
            Starred ({starredCount})
          </p>
          <div className="flex flex-wrap gap-2">
            {starred.words.map((text) => (
              <div
                key={`w-${text}`}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm ring-1 ring-primary/30"
              >
                <button
                  type="button"
                  onClick={() => toggleStar(text, true)}
                  className="btn btn-ghost btn-xs px-1"
                  aria-label="Unstar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-warning">
                    <path d="M12 2.25l2.955 6.016 6.645.967-4.8 4.68 1.133 6.617L12 17.75l-5.933 3.12 1.133-6.617-4.8-4.68 6.645-.967L12 2.25z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/thinking?highlight=${encodeURIComponent(text)}`)}
                  className="font-medium hover:text-primary"
                >
                  {text}
                </button>
                <span className="text-[10px] text-base-content/50">word</span>
              </div>
            ))}
            {starred.phrases.map((text) => (
              <div
                key={`p-${text}`}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm ring-1 ring-primary/30"
              >
                <button
                  type="button"
                  onClick={() => toggleStar(text, false)}
                  className="btn btn-ghost btn-xs px-1"
                  aria-label="Unstar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-warning">
                    <path d="M12 2.25l2.955 6.016 6.645.967-4.8 4.68 1.133 6.617L12 17.75l-5.933 3.12 1.133-6.617-4.8-4.68 6.645-.967L12 2.25z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/thinking?highlight=${encodeURIComponent(text)}`)}
                  className="font-medium hover:text-primary"
                >
                  {text}
                </button>
                <span className="text-[10px] text-base-content/50">phrase</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
