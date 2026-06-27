import { useEffect } from "react";

export function useWorkspacePrefetchController({ prefetchWorkspace, view, viewPrefetchMap }) {
  useEffect(() => {
    const likelyNextViews = viewPrefetchMap[view] || [];
    if (!likelyNextViews.length) return undefined;

    let cancelled = false;
    let timeoutId = null;
    let idleCallbackId = null;
    const runPrefetch = () => {
      if (cancelled) return;
      likelyNextViews.forEach(prefetchWorkspace);
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleCallbackId = window.requestIdleCallback(runPrefetch, { timeout: 800 });
    } else {
      timeoutId = window.setTimeout(runPrefetch, 250);
    }

    return () => {
      cancelled = true;
      if (timeoutId != null) window.clearTimeout(timeoutId);
      if (idleCallbackId != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [prefetchWorkspace, view, viewPrefetchMap]);
}
