import { useCallback, useEffect, useRef, useState } from "react";
import { moveNavigation, pushNavigation } from "./navigationHistory.ts";

export function useWorkspaceNavigation(initialView, context, applyContext) {
  const [history, setHistory] = useState(() => ({ entries: [{ view: initialView, ...context }], index: 0 }));
  const current = useRef(history);
  const view = history.entries[history.index].view;
  // Keep the active visit's scope current, including changes batched with navigation.
  useEffect(() => {
    const next = { ...current.current, entries: current.current.entries.map((entry, index) => index === current.current.index ? { view, ...context } : entry) };
    current.current = next;
    setHistory(next);
  }, [view, context]);
  const setView = useCallback((nextView) => {
    const active = current.current.entries[current.current.index];
    const destination = typeof nextView === "function" ? nextView(active.view) : nextView;
    const next = pushNavigation(current.current, { ...active, view: destination });
    current.current = next;
    setHistory(next);
  }, []);
  const move = useCallback((delta) => {
    const next = moveNavigation(current.current, delta);
    if (next === current.current) return;
    current.current = next;
    applyContext(next.entries[next.index]);
    setHistory(next);
  }, [applyContext]);
  useEffect(() => {
    const onKey = (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      if (document.querySelector('dialog[open], [role="dialog"]')) return;
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);
  return { view, setView, goBack: () => move(-1), goForward: () => move(1), canGoBack: history.index > 0, canGoForward: history.index < history.entries.length - 1 };
}
