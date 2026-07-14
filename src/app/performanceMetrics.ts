import { useEffect, useState } from "react";

type RuntimeMetricName = "workspaceSwitchMs" | "documentFileReadMs" | "documentAnalysisMs";
type RuntimePerformanceMetrics = Record<RuntimeMetricName, number | null>;
type PerformanceMetricEventDetail = { name: RuntimeMetricName; durationMs: number };

const PERFORMANCE_EVENT = "rental-tracker:performance-metric";

export function publishPerformanceMetric(name: RuntimeMetricName, durationMs: number): void {
  if (typeof window === "undefined" || !Number.isFinite(durationMs)) return;
  window.dispatchEvent(new CustomEvent<PerformanceMetricEventDetail>(PERFORMANCE_EVENT, {
    detail: { name, durationMs: Math.round(durationMs) },
  }));
}

export function useRuntimePerformanceMetrics(view: string): RuntimePerformanceMetrics {
  const [metrics, setMetrics] = useState<RuntimePerformanceMetrics>({ workspaceSwitchMs: null, documentFileReadMs: null, documentAnalysisMs: null });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const startedAt = performance.now();
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setMetrics((previous) => ({ ...previous, workspaceSwitchMs: Math.round(performance.now() - startedAt) }));
      });
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [view]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onMetric = (event: Event) => {
      const detail = (event as CustomEvent<PerformanceMetricEventDetail>).detail;
      if (!detail?.name || !Number.isFinite(detail.durationMs)) return;
      setMetrics((previous) => ({ ...previous, [detail.name]: detail.durationMs }));
    };
    window.addEventListener(PERFORMANCE_EVENT, onMetric);
    return () => window.removeEventListener(PERFORMANCE_EVENT, onMetric);
  }, []);

  return metrics;
}
