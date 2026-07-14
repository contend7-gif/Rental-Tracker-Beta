import { useMemo, useState } from "react";
import type { ActivityLogEntry } from "../models.ts";
import { createActivityActions, mergeActivityLogEntries } from "./activityStore.ts";

export function useActivitySlice({ actorName, actorRole }: { actorName?: string; actorRole?: string } = {}) {
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const actions = useMemo(() => ({
    ...createActivityActions({ setActivityLog, actorName, actorRole }),
    mergeActivityLog(entries: ActivityLogEntry[]) {
      const incoming = Array.isArray(entries) ? entries : [];
      setActivityLog((previous) => mergeActivityLogEntries(previous, incoming));
    },
  }), [actorName, actorRole]);

  return { activityLog, setActivityLog, actions };
}
