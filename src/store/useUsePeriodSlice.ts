import { useCallback, useMemo, useRef, useState } from "react";
import type { UsePeriod } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { createUsePeriodActions } from "./usePeriodStore.ts";

type StateUpdater<T> = T[] | ((previous: T[]) => T[]);

export function useUsePeriodSlice({ appendActivityLog }: { appendActivityLog: AppendActivityLog }) {
  const [usePeriods, setUsePeriodState] = useState<UsePeriod[]>([]);
  const usePeriodsRef = useRef(usePeriods);
  usePeriodsRef.current = usePeriods;
  const setUsePeriods = useCallback((updater: StateUpdater<UsePeriod>) => setUsePeriodState(updater), []);
  const actions = useMemo(() => createUsePeriodActions({
    getUsePeriods: () => usePeriodsRef.current,
    setUsePeriods,
    appendActivityLog,
  }), [appendActivityLog, setUsePeriods]);
  return { usePeriods, setUsePeriods, actions };
}
