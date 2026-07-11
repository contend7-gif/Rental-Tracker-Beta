import { useEffect } from "react";

const STARTUP_PREFETCH_DELAY_MS = 2000;

export function useWorkspacePrefetchController({ prefetchWorkspace, view, viewPrefetchMap }) {
  useEffect(() => {
    const likelyNextViews = viewPrefetchMap[view] || [];
    if (!likelyNextViews.length) return undefined;

    let cancelled = false;
    let timeoutId = null;
    let idleCallbackId = null;
    const [likelyNextView] = likelyNextViews;
    const runPrefetch = () => {
      if (cancelled) return;
      prefetchWorkspace(likelyNextView);
    };

    timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        idleCallbackId = window.requestIdleCallback(runPrefetch, { timeout: 1200 });
        return;
      }
      runPrefetch();
    }, STARTUP_PREFETCH_DELAY_MS);

    return () => {
      cancelled = true;
      if (timeoutId != null) window.clearTimeout(timeoutId);
      if (idleCallbackId != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [prefetchWorkspace, view, viewPrefetchMap]);
}
