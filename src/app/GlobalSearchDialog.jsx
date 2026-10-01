import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { buildGlobalSearchIndex, searchGlobalRecords } from "./globalSearch.ts";

const labels = { transaction: "Transaction", document: "Document", lease: "Lease", maintenance: "Maintenance", property: "Property", navigation: "Go to", action: "Create" };

export default function GlobalSearchDialog({ collections, propertyNames, onSelect, onClose }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selected, setSelected] = useState(0);
  const index = useMemo(() => buildGlobalSearchIndex(collections, propertyNames), [collections, propertyNames]);
  const results = useMemo(() => searchGlobalRecords(index, deferredQuery), [index, deferredQuery]);
  const active = Math.min(selected, Math.max(0, results.length - 1));

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current.showModal();
    inputRef.current.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  const choose = (result) => { onClose(); onSelect(result); };
  const onKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % Math.max(1, results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const currentResults = query === deferredQuery ? results : searchGlobalRecords(index, query);
      const result = currentResults[query === deferredQuery ? active : 0];
      if (result) choose(result);
    }
  };

  useEffect(() => { document.getElementById(`global-result-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  return (
    <dialog ref={dialogRef} aria-labelledby="global-search-title" onCancel={onClose} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }} className="fixed top-[12vh] m-auto w-[min(42rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 id="global-search-title" className="text-sm font-semibold">Search and actions</h2>
        <button type="button" aria-label="Close search" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <Search className="h-4 w-4 text-slate-500" />
        <input ref={inputRef} aria-label="Search all records and actions" role="combobox" aria-expanded="true" aria-controls="global-search-results" aria-autocomplete="list" aria-activedescendant={results.length ? `global-result-${active}` : undefined} placeholder="Search records, screens, or actions…" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} onKeyDown={onKeyDown} className="w-full bg-transparent text-sm outline-none" />
      </div>
      <div id="global-search-results" role="listbox" aria-label="Search results" className="max-h-[50vh] overflow-y-auto p-2" aria-busy={query !== deferredQuery}>
        {results.map((result, position) => (
          <div key={result.key} id={`global-result-${position}`} role="option" aria-selected={position === active} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setSelected(position)} onClick={() => choose(result)} className={`cursor-pointer rounded-lg px-3 py-2 ${position === active ? "bg-teal-50" : "hover:bg-slate-50"}`}>
            <div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-medium">{result.title}</span><span className="shrink-0 text-xs text-slate-500">{labels[result.kind]}</span></div>
            {result.detail && <div className="truncate text-xs text-slate-500">{result.detail}</div>}
          </div>
        ))}
        {!results.length && <div className="p-4 text-sm text-slate-500" role="status">No matching records or actions.</div>}
      </div>
      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">↑ ↓ to choose · Enter to open · Escape to close · Searches all properties and years</div>
    </dialog>
  );
}
