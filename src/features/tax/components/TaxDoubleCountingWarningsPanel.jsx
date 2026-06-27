import React from "react";

export function groupTaxDoubleCountingWarnings(warnings = []) {
  const grouped = new Map();

  warnings.forEach((warning) => {
    const groupKey = `${warning.key || "warning"}|${warning.label || ""}|${warning.targetView || ""}`;
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.count += 1;
      if (warning.sourceId) existing.sourceIds.push(warning.sourceId);
      return;
    }
    grouped.set(groupKey, {
      ...warning,
      count: 1,
      sourceIds: warning.sourceId ? [warning.sourceId] : [],
    });
  });

  return Array.from(grouped.values());
}

export function TaxDoubleCountingWarningsPanel({ warnings = [], limit }) {
  const groupedWarnings = groupTaxDoubleCountingWarnings(warnings);
  const visibleWarnings = typeof limit === "number" ? groupedWarnings.slice(0, limit) : groupedWarnings;
  const hiddenCount = groupedWarnings.length - visibleWarnings.length;

  if (!visibleWarnings.length) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
      <div className="font-semibold">Tax posting and double-counting checks</div>
      <div className="mt-1 space-y-1">
        {visibleWarnings.map((warning) => (
          <div key={`double-count-${warning.key}-${warning.sourceIds.join("-") || warning.sourceId || "scope"}`}>
            <span>{warning.label}</span>
            {warning.count > 1 ? <span className="font-semibold"> ({warning.count} entries)</span> : null}
            {warning.count > 1 ? (
              <div className="text-[11px] text-amber-800">Grouped from matching source-record checks.</div>
            ) : null}
          </div>
        ))}
        {hiddenCount > 0 ? <div className="text-[11px] text-amber-800">+{hiddenCount} more grouped check{hiddenCount === 1 ? "" : "s"} in the full tab.</div> : null}
      </div>
    </div>
  );
}
