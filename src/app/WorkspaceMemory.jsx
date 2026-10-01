import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";

const WorkspaceMemoryContext = createContext(null);

// Session-only UI preferences. Never retain file bytes, drafts, or bulk selections here.
export function WorkspaceMemoryProvider({ children }) {
  const memory = useRef(new Map());
  return <WorkspaceMemoryContext.Provider value={memory.current}>{children}</WorkspaceMemoryContext.Provider>;
}

export function useWorkspaceMemory(key, initial) {
  const memory = useContext(WorkspaceMemoryContext);
  const [value, setValue] = useState(() => memory?.has(key) ? memory.get(key) : typeof initial === "function" ? initial() : initial);
  const current = useRef(value);
  const setRememberedValue = useCallback((next) => {
    const resolved = typeof next === "function" ? next(current.current) : next;
    current.current = resolved;
    memory?.set(key, resolved);
    setValue(resolved);
  }, [key, memory]);
  return [value, setRememberedValue];
}

// Mount inside Suspense, after the destination's lazy content is ready.
export function WorkspaceScroll({ view, children }) {
  const memory = useContext(WorkspaceMemoryContext);
  useLayoutEffect(() => {
    const saved = memory?.get(`scroll:${view}`) || 0;
    window.scrollTo({ top: saved, behavior: "instant" });
    const remember = () => memory?.set(`scroll:${view}`, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [view, memory]);
  return children;
}
