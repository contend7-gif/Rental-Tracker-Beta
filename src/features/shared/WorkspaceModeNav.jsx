import React from "react";

export function WorkspaceModeNav({ label, modes, value, onChange, icons = {} }) {
  return <div role="tablist" aria-label={label} className="rt-workspace-mode-nav flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5">
    {modes.map((mode, index) => {
      const selected = value === mode.key;
      const Icon = icons[mode.key];
      return <button key={mode.key} type="button" role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1}
        title={mode.description}
        className={`flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${selected ? "border-teal-700 bg-teal-700 text-white shadow-sm" : "border-transparent text-slate-600 hover:border-teal-100 hover:bg-white hover:text-teal-800"}`}
        onClick={() => onChange(mode.key)}
        onKeyDown={(event) => {
          const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
          if (!offset && event.key !== "Home" && event.key !== "End") return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? modes.length - 1 : (index + offset + modes.length) % modes.length;
          onChange(modes[next].key);
          event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
        }}>
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {mode.label}
        {mode.badge != null && <span className={`rounded-full px-2 py-0.5 text-[11px] ${selected ? "bg-white/15 text-white" : "bg-white text-slate-500"}`}>{mode.badge}</span>}
      </button>;
    })}
  </div>;
}
