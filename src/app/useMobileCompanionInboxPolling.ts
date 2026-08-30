import { useCallback, useEffect, useRef, useState } from "react";
import type { CompanionMileageEntry, CompanionSubmission, DesktopCompanionApi } from "../types/desktop.d.ts";

export const MOBILE_COMPANION_POLL_INTERVAL_MS = 30_000;

export function countMobileCompanionWaiting(
  submissions: Array<Pick<CompanionSubmission, "status">> = [],
  mileageEntries: Array<Pick<CompanionMileageEntry, "status">> = [],
): number {
  return submissions.filter((item) => item.status !== "imported").length
    + mileageEntries.filter((item) => item.status !== "imported").length;
}

export function useMobileCompanionInboxPolling({
  enabled,
  desktopCompanionApi,
}: {
  enabled: boolean;
  desktopCompanionApi: DesktopCompanionApi | null;
}): number | null {
  const [waitingCount, setWaitingCount] = useState<number | null>(null);
  const refreshInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || !desktopCompanionApi?.getStatus || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const status = await desktopCompanionApi.getStatus();
      if (!status?.configured) {
        setWaitingCount(null);
        return;
      }
      const [captureResult, mileageResult] = await Promise.all([
        desktopCompanionApi.list(),
        desktopCompanionApi.listMileage
          ? desktopCompanionApi.listMileage()
          : Promise.resolve({ ok: true, mileageEntries: [] }),
      ]);
      if (captureResult?.ok === false || mileageResult?.ok === false) return;
      setWaitingCount(countMobileCompanionWaiting(
        captureResult?.submissions ?? [],
        mileageResult?.mileageEntries ?? [],
      ));
    } catch {
      // Keep the last useful count during a transient connection failure.
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [desktopCompanionApi, enabled]);

  useEffect(() => {
    if (!enabled || !desktopCompanionApi) {
      setWaitingCount(null);
      return undefined;
    }
    void refresh();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, MOBILE_COMPANION_POLL_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [desktopCompanionApi, enabled, refresh]);

  return waitingCount;
}
