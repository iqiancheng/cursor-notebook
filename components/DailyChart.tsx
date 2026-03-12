"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";

type ByDay = Record<string, Record<string, number>>;
type ChartMode = "line" | "stacked";

export function DailyChart({ days = 7 }: { days?: number }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ByDay | null>(null);
  const [mode, setMode] = useState<ChartMode>("line");

  useEffect(() => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    fetch(`/api/events?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((res) => setData(res.byDay))
      .catch(() => setData(null));
  }, [days]);

  useEffect(() => {
    if (!chartRef.current || !data) return;

    const dates = Object.keys(data).sort();
    const prompts = dates.map((d) => data[d]?.beforeSubmitPrompt ?? 0);
    const toolCalls = dates.map((d) => data[d]?.postToolUse ?? 0);
    const thoughts = dates.map((d) => data[d]?.afterAgentThought ?? 0);

    const chart = echarts.init(chartRef.current);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);

    const isStacked = mode === "stacked";
    const series = isStacked
      ? [
          { name: "Prompts", type: "line", stack: "total", data: prompts, smooth: true, symbol: "circle", symbolSize: 4, areaStyle: { opacity: 0.4 } },
          { name: "Tool calls", type: "line", stack: "total", data: toolCalls, smooth: true, symbol: "circle", symbolSize: 4, areaStyle: { opacity: 0.4 } },
          { name: "Thinking", type: "line", stack: "total", data: thoughts, smooth: true, symbol: "circle", symbolSize: 4, areaStyle: { opacity: 0.4 } },
        ]
      : [
          { name: "Prompts", type: "line", data: prompts, smooth: true, symbol: "circle", symbolSize: 4, areaStyle: { opacity: 0.12 } },
          { name: "Tool calls", type: "line", data: toolCalls, smooth: true, symbol: "circle", symbolSize: 4, areaStyle: { opacity: 0.12 } },
          { name: "Thinking", type: "line", data: thoughts, smooth: true, symbol: "circle", symbolSize: 4, areaStyle: { opacity: 0.12 } },
        ];

    chart.setOption({
      color: ["#3b82f6", "#0ea5e9", "#16a34a"],
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15,23,42,0.9)",
        borderWidth: 0,
        textStyle: { color: "#e5e7eb", fontSize: 12 },
        axisPointer: { type: "line" },
      },
      legend: {
        data: ["Prompts", "Tool calls", "Thinking"],
        bottom: 0,
        textStyle: { color: "#6b7280", fontSize: 11 },
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: { left: "3%", right: "4%", bottom: "18%", top: "10%", containLabel: true },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: "#e5e7eb" } },
        axisLabel: { color: "#6b7280", fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisLabel: { color: "#6b7280", fontSize: 11 },
        splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } },
      },
      series,
    });

    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [data, mode]);

  if (data === null) {
    return (
      <div className="rounded-xl bg-base-100 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <p className="text-sm text-base-content/70">Unable to load trend data</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-base-100 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-base-content">
          Last {days} days
        </h3>
        <div className="btn-group btn-group-xs">
          <button
            type="button"
            className={`btn btn-xs ${mode === "line" ? "btn-active" : ""}`}
            onClick={() => setMode("line")}
          >
            Line
          </button>
          <button
            type="button"
            className={`btn btn-xs ${mode === "stacked" ? "btn-active" : ""}`}
            onClick={() => setMode("stacked")}
          >
            Stacked
          </button>
        </div>
      </div>
      <div ref={chartRef} className="h-64 w-full" />
    </div>
  );
}
