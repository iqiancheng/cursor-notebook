"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

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
}: {
  items: { name: string; value: number }[];
  onBarClick?: (name: string) => void;
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

      const top30 = items.slice(0, 30).reverse();
      chart.setOption({
        color: ["#3b82f6"],
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: "rgba(15,23,42,0.9)",
          borderWidth: 0,
          textStyle: { color: "#e5e7eb", fontSize: 12 },
        },
        grid: { left: 120, right: 30, top: 10, bottom: 30 },
        xAxis: {
          type: "value",
          axisLine: { show: false },
          axisLabel: { color: "#6b7280", fontSize: 11 },
          splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } },
        },
        yAxis: {
          type: "category",
          data: top30.map((d) => d.name),
          axisLabel: { fontSize: 12, color: "#374151" },
        },
        series: [
          {
            type: "bar",
            data: top30.map((d) => d.value),
            itemStyle: { borderRadius: [0, 6, 6, 0] },
            emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(59,130,246,0.4)" } },
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
  }, [items]);

  if (items.length === 0) return null;
  return <div ref={chartRef} className="h-[500px] w-full" />;
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      placeholder="Search..."
      className="input input-bordered input-sm w-full max-w-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function VocabStats() {
  const router = useRouter();
  const [data, setData] = useState<VocabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("words");
  const [search, setSearch] = useState("");
  const [starredWords, setStarredWords] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("vocab_new_words_v1");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((w): w is string => typeof w === "string");
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [minCount, setMinCount] = useState(1);
  const [showFullList, setShowFullList] = useState(false);

  useEffect(() => {
    fetch("/api/vocab?wordLimit=1000&phraseLimit=1000")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("vocab_new_words_v1", JSON.stringify(starredWords));
    } catch {
      // ignore
    }
  }, [starredWords]);

  const filteredWords = useMemo(() => {
    if (!data) return [];
    let items = data.words;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((w) => w.word.includes(q));
    }
    if (onlyStarred) {
      items = items.filter((w) => starredWords.includes(w.word));
    }
    if (minCount > 1) {
      items = items.filter((w) => w.count >= minCount);
    }
    const sorted = [...items].sort((a, b) => (sortAsc ? a.count - b.count : b.count - a.count));
    return sorted;
  }, [data, search, onlyStarred, starredWords, sortAsc, minCount]);

  const filteredPhrases = useMemo(() => {
    if (!data) return [];
    let items = data.phrases;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.phrase.includes(q));
    }
    if (minCount > 1) {
      items = items.filter((p) => p.count >= minCount);
    }
    const sorted = [...items].sort((a, b) => (sortAsc ? a.count - b.count : b.count - a.count));
    return sorted;
  }, [data, search, sortAsc, minCount]);

  const toggleStar = (word: string) => {
    setStarredWords((prev) => (prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]));
  };

  const handleExport = () => {
    const items = tab === "words" ? filteredWords : filteredPhrases;
    if (items.length === 0) return;

    const lines = [
      tab === "words" ? "rank,word,count" : "rank,phrase,count",
      ...items.map((item, index) => {
        const text = "word" in item ? item.word : (item as PhraseFreq).phrase;
        const safeText = `"${text.replace(/\"/g, '\"\"')}"`;
        return `${index + 1},${safeText},${item.count}`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tab === "words" ? "vocab_words.csv" : "vocab_phrases.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  const chartItems = (tab === "words" ? filteredWords : filteredPhrases).map((d) => ({
    name: "word" in d ? d.word : (d as PhraseFreq).phrase,
    value: d.count,
  }));

  const currentItems = tab === "words" ? filteredWords : filteredPhrases;

  return (
    <div className="space-y-6">
      {/* summary cards */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Thinking records", value: data.totalRecords },
          { label: "Frequent phrases", value: data.phrases.length },
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

      {/* tabs + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="tabs tabs-bordered">
          <button
            type="button"
            role="tab"
            className={`tab ${tab === "words" ? "tab-active" : ""}`}
            onClick={() => {
              setTab("words");
              setSearch("");
            }}
          >
            Word frequency
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${tab === "phrases" ? "tab-active" : ""}`}
            onClick={() => {
              setTab("phrases");
              setSearch("");
            }}
          >
            Phrase frequency
          </button>
        </div>
        <SearchInput value={search} onChange={setSearch} />
        {tab === "words" && (
          <label className="label cursor-pointer gap-2">
            <span className="label-text text-sm">Only starred words</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={onlyStarred}
              onChange={() => setOnlyStarred((v) => !v)}
            />
          </label>
        )}
        <label className="label cursor-pointer gap-2">
          <span className="label-text text-sm">Min count</span>
          <select
            className="select select-xs"
            value={minCount}
            onChange={(e) => setMinCount(Number(e.target.value) || 1)}
          >
            <option value={1}>≥1</option>
            <option value={2}>≥2</option>
            <option value={3}>≥3</option>
            <option value={5}>≥5</option>
            <option value={10}>≥10</option>
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <div className="btn-group btn-group-xs">
            <button
              type="button"
              className={`btn btn-xs ${!sortAsc ? "btn-active" : ""}`}
              onClick={() => setSortAsc(false)}
            >
              Count ↓
            </button>
            <button
              type="button"
              className={`btn btn-xs ${sortAsc ? "btn-active" : ""}`}
              onClick={() => setSortAsc(true)}
            >
              Count ↑
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={handleExport}
            disabled={currentItems.length === 0}
          >
            Export current list
          </button>
        </div>
      </div>

      {/* chart - primary view, click bar to open in Thinking */}
      <div className="rounded-xl bg-base-100 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <p className="mb-2 text-xs text-base-content/50">Top 30 · Click a bar to view in Thinking</p>
        <BarChart
          items={chartItems}
          onBarClick={(name) => router.push(`/thinking?highlight=${encodeURIComponent(name)}`)}
        />
      </div>

      {/* collapsible full list */}
      <div className="rounded-xl bg-base-100 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <button
          type="button"
          onClick={() => setShowFullList((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-base-content/80 hover:bg-base-200/50 transition"
        >
          <span>{showFullList ? "Hide" : "Show"} full list ({currentItems.length} items)</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition ${showFullList ? "rotate-180" : ""}`}
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>
        {showFullList && (
          <div className="border-t border-base-200 p-4">
            {currentItems.length === 0 ? (
              <div className="py-8 text-center opacity-50">No matching results</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4">
                {currentItems.map((item, index) => {
                  const isWord = "word" in item;
                  const text = isWord ? item.word : (item as PhraseFreq).phrase;
                  const starred = isWord && starredWords.includes(text);
                  return (
                    <div
                      key={text}
                      className={`flex cursor-pointer flex-col justify-between rounded-lg bg-base-100 p-3 text-sm shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:bg-base-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] ${
                        starred ? "ring-1 ring-warning/50" : ""
                      }`}
                      onClick={() => {
                        router.push(`/thinking?highlight=${encodeURIComponent(text)}`);
                      }}
                    >
                      <div className="mb-2 flex items-start justify-between gap-1">
                        <div className="font-mono text-xs md:text-sm break-words">
                          <span className="mr-1 text-[10px] text-zinc-400">#{index + 1}</span>
                          {text}
                        </div>
                        {isWord && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs px-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStar(text);
                            }}
                            aria-label={starred ? "Unstar word" : "Mark as new word"}
                          >
                            {starred ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="h-3 w-3 text-warning"
                              >
                                <path d="M12 2.25l2.955 6.016 6.645.967-4.8 4.68 1.133 6.617L12 17.75l-5.933 3.12 1.133-6.617-4.8-4.68 6.645-.967L12 2.25z" />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="h-3 w-3"
                              >
                                <path d="M12 2.75l2.7 5.5 6.05.88-4.375 4.27 1.033 6.02L12 16.96l-5.408 2.91 1.033-6.02L3.25 9.13l6.05-.88L12 2.75z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>{tab === "words" ? "Word" : "Phrase"}</span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                          {item.count} times
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
