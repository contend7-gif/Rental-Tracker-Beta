export function formatUnitLabel(unitName) {
  const value = String(unitName || "").trim();
  if (!value) return "Unit not entered";
  if (/^shared$/i.test(value) || /^all$/i.test(value)) return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return /^unit\b/i.test(value) ? value : `Unit ${value}`;
}
