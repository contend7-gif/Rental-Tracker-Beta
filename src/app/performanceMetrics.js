import { useEffect, useState } from "react";

const PERFORMANCE_EVENT = "rental-tracker:performance-metric";

export function publishPerformanceMetric(name, durationMs) {
  if (typeof window === "undefined" || !Number.isFinite(durationMs)) return;
  window.dispatchEvent(new CustomEvent(PERFORMANCE_EVENT, {
    detail: { name, durationMs: Math.round(durationMs) },
  }));
}

export function useRuntimePerformanceMetrics(view) {
  const [metrics, setMetrics] = useState({ workspaceSwitchMs: null, documentFileReadMs: null });

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
    const onMetric = (event) => {
      const detail = event?.detail;
      if (!detail?.name || !Number.isFinite(detail.durationMs)) return;
      setMetrics((previous) => ({ ...previous, [detail.name]: detail.durationMs }));
    };
    window.addEventListener(PERFORMANCE_EVENT, onMetric);
    return () => window.removeEventListener(PERFORMANCE_EVENT, onMetric);
  }, []);

  return metrics;
}
