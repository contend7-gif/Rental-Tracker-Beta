export type NavigationEntry = { view: string; yearFilter: string; propertyFilter: string; unitFilter: string };
export type NavigationHistory = { entries: NavigationEntry[]; index: number };

export function pushNavigation(history: NavigationHistory, entry: NavigationEntry, limit = 100): NavigationHistory {
  if (history.entries[history.index].view === entry.view) return history;
  const entries = [...history.entries.slice(0, history.index + 1), entry].slice(-Math.max(2, limit));
  return { entries, index: entries.length - 1 };
}

export function moveNavigation(history: NavigationHistory, delta: number): NavigationHistory {
  const index = Math.max(0, Math.min(history.entries.length - 1, history.index + delta));
  return index === history.index ? history : { ...history, index };
}
