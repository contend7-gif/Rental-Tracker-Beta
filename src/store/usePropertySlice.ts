import { useCallback, useMemo, useState } from "react";
import type { Asset, Property, Unit } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { createPropertyActions } from "./propertyStore.ts";

type StateUpdater<T> = T[] | ((previous: T[]) => T[]);

export function usePropertySlice({
  setAssets,
  appendActivityLog,
}: {
  setAssets: (updater: StateUpdater<Asset>) => void;
  appendActivityLog: AppendActivityLog;
}) {
  const [properties, setPropertyState] = useState<Property[]>([]);
  const [units, setUnitState] = useState<Unit[]>([]);
  const setProperties = useCallback((updater: StateUpdater<Property>) => setPropertyState(updater), []);
  const setUnits = useCallback((updater: StateUpdater<Unit>) => setUnitState(updater), []);
  const actions = useMemo(() => createPropertyActions({
    properties,
    setProperties,
    setUnits,
    setAssets,
    appendActivityLog,
  }), [appendActivityLog, properties, setAssets, setProperties, setUnits]);
  return { properties, setProperties, units, setUnits, actions };
}
