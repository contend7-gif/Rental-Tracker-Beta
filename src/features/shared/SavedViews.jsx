import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export function useListPreference(key, initial, validate) {
  const storageKey = `rental-tracker:list:v1:${key}`;
  const [value, setValue] = useState(() => {
    try { const stored = JSON.parse(localStorage.getItem(storageKey)); return validate(stored) ? stored : initial; } catch { return initial; }
  });
  const update = (next) => setValue((previous) => {
    const resolved = typeof next === "function" ? next(previous) : next;
    try { localStorage.setItem(storageKey, JSON.stringify(resolved)); } catch { /* Preferences still work for this session. */ }
    return resolved;
  });
  return [value, update];
}

export function SavedViews({ viewKey, filters, onApply }) {
  const [views, setViews] = useListPreference(`${viewKey}:saved`, [], (value) => Array.isArray(value) && value.length <= 12 && value.every((view) => typeof view?.name === "string" && view.name.length <= 40 && view.filters && typeof view.filters === "object"));
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  return <details className="col-span-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
    <summary className="cursor-pointer font-medium">Saved views</summary>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Input aria-label="Saved view name" placeholder="Name this view" maxLength={40} value={name} onChange={(event) => setName(event.target.value)} className="max-w-56" />
      <Button size="sm" disabled={!name.trim()} onClick={() => { const label = name.trim(); setViews((previous) => [{ name: label, filters }, ...previous.filter((view) => view.name !== label)].slice(0, 12)); setSelected(label); setName(""); setMessage(`Saved ${label}.`); }}>Save current view</Button>
      <select aria-label="Saved views" value={selected} className="h-8 rounded-md border border-slate-300 bg-white px-2" onChange={(event) => { const label = event.target.value; setSelected(label); const view = views.find((item) => item.name === label); if (view) { onApply(view.filters); setMessage(`Applied ${label}.`); } }}>
        <option value="">Choose a saved view</option>{views.map((view) => <option key={view.name} value={view.name}>{view.name}</option>)}
      </select>
      <Button size="sm" variant="secondary" disabled={!selected} onClick={() => { const view = views.find((item) => item.name === selected); if (view) { onApply(view.filters); setMessage(`Applied ${selected}.`); } }}>Apply view</Button>
      <Button size="sm" variant="secondary" disabled={!selected} onClick={() => { setViews((previous) => previous.filter((view) => view.name !== selected)); setSelected(""); setMessage("Saved view removed."); }}>Remove view</Button>
    </div>
    <p role="status" className="mt-2 text-xs text-slate-600">{message || "Save up to 12 named filter combinations. Property, unit, and year stay in the header."}</p>
  </details>;
}
