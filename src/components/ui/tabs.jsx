import React, { createContext, useContext, useMemo, useState } from "react";

const TabsContext = createContext(null);

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function Tabs({ value: controlledValue, defaultValue, onValueChange, children, className, ...props }) {
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const value = controlledValue ?? internalValue;
  const setValue = onValueChange ?? setInternalValue;
  const ctx = useMemo(() => ({ value, setValue }), [value, setValue]);

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("space-y-2", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className, ...props }) {
  return (
    <div className={cn("inline-flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 p-1 text-slate-600", className)} {...props}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className, ...props }) {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => ctx?.setValue(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition",
        active ? "bg-white text-teal-900 shadow-sm" : "text-slate-600 hover:bg-white/70 hover:text-slate-950",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className, ...props }) {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return (
    <div className={cn("mt-2", className)} {...props}>
      {children}
    </div>
  );
}
