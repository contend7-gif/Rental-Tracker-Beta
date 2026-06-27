import React from "react";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";

export function ResponsiveTableFrame({
  children,
  className = "",
  minWidthClass = "min-w-[640px]",
  hint = "Swipe sideways to see all columns.",
  mobileCards = null,
}) {
  return (
    <div className={className}>
      {mobileCards ? <div className="space-y-2 md:hidden">{mobileCards}</div> : null}
      <div className={mobileCards ? "hidden md:block" : ""}>
        <div className="mb-1 text-[11px] text-slate-500 md:hidden">{hint}</div>
        <div className="-mx-2 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm sm:mx-0">
          <div className={minWidthClass}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function field(label, child, options = {}) {
  return (
    <div className={options.highlighted ? "rounded-lg border border-blue-200 bg-blue-50/60 p-2" : ""}>
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        {options.badgeLabel ? (
          <Badge variant="outline" className="border-blue-200 text-[10px] text-blue-800 hover:bg-white">
            {options.badgeLabel}
          </Badge>
        ) : null}
      </div>
      {child}
      {options.hint ? <div className="mt-1 text-[11px] text-blue-800">{options.hint}</div> : null}
    </div>
  );
}
