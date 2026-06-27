import { useCallback, useMemo } from "react";

export function useWorkspaceFilterOptions({
  properties,
  propertyFilter,
  units,
}) {
  const propertyNameById = useMemo(
    () => Object.fromEntries(properties.map((property) => [property.id, property.name])),
    [properties],
  );

  const unitFilterOptions = useMemo(() => {
    if (propertyFilter === "all") return [{ value: "all", label: "All units" }];
    const names = ["Shared", ...units.filter((unit) => unit.propertyId === propertyFilter).map((unit) => unit.name)];
    const unique = Array.from(new Set(names));
    return [{ value: "all", label: "All units" }, ...unique.map((name) => ({ value: name, label: name }))];
  }, [propertyFilter, units]);

  const formatPropertyLabel = useCallback(
    (propertyId) => (propertyId === "all" ? "All properties" : (propertyNameById[propertyId] || propertyId)),
    [propertyNameById],
  );

  const formatUnitLabel = useCallback((unitId) => (unitId === "all" ? "All units" : unitId), []);

  return {
    formatPropertyLabel,
    formatUnitLabel,
    propertyNameById,
    unitFilterOptions,
  };
}
