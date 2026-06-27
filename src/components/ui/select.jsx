import React, { createContext, useContext, useMemo, useState } from "react";

const SelectContext = createContext(null);

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

function flattenChildren(children) {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    if (child.type === SelectItem) return [child];
    if (child.props?.children) return flattenChildren(child.props.children);
    return [];
  });
}

export function Select({ value: controlledValue, onValueChange, children, className, ...props }) {
  const [internalValue, setInternalValue] = useState(String(controlledValue ?? ""));
  const value = String(controlledValue ?? internalValue ?? "");
  const items = flattenChildren(children)
    .map((child) => ({ value: String(child.props.value ?? ""), label: child.props.children }))
    .filter((item) => item.value !== undefined);

  const setValue = (next) => {
    if (onValueChange) onValueChange(next);
    if (controlledValue === undefined) setInternalValue(next);
  };

  const ctx = useMemo(() => ({ value, setValue, items }), [value, items]);

  return (
    <SelectContext.Provider value={ctx}>
      <div className={className} {...props}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className, children: _children, ...props }) {
  const ctx = useContext(SelectContext);
  return (
    <select
      value={String(ctx?.value ?? "")}
      onChange={(e) => ctx?.setValue(e.target.value)}
      className={cn(
        "h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[13px] shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
        className,
      )}
      {...props}
    >
      {(ctx?.items ?? []).map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

export function SelectValue() {
  return null;
}

export function SelectContent({ children }) {
  return <>{children}</>;
}

export function SelectItem() {
  return null;
}
