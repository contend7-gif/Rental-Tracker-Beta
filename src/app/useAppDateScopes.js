import { useMemo } from "react";
import { toLocalIsoDate } from "../lib/localDate.ts";

export function buildAppDateScopes({ yearFilter, now = new Date() }) {
  const today = toLocalIsoDate(now);
  const currentYear = now.getFullYear();
  const selectedYear = Number(yearFilter);

  return {
    recurringThroughDate: selectedYear < currentYear ? `${yearFilter}-12-31` : today,
    todayIso: today,
  };
}

export function useAppDateScopes({ yearFilter }) {
  const recurringThroughDate = useMemo(() => {
    const now = new Date();
    return buildAppDateScopes({ yearFilter, now }).recurringThroughDate;
  }, [yearFilter]);

  const todayIso = useMemo(() => buildAppDateScopes({ yearFilter }).todayIso, [yearFilter]);

  return {
    recurringThroughDate,
    todayIso,
  };
}
