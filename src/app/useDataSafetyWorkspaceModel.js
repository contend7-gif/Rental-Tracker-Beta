import { useMemo } from "react";
import { buildCurrentDataStatusPanel, buildDemoLoadWarning, isAppDataEmpty } from "../domain/dataSafety.ts";
import { buildRealDataChecklist } from "../domain/realDataChecklist.ts";

export function useDataSafetyWorkspaceModel({ state, persistenceHealth, backupValidationResult }) {
  return useMemo(() => {
    const hasAnyData = !isAppDataEmpty(state);
    return {
      hasAnyData,
      currentDataStatus: buildCurrentDataStatusPanel({
        state,
        persistenceHealth,
        backupValidationResult,
      }),
      realDataChecklist: buildRealDataChecklist({
        state,
        persistenceHealth,
        backupValidationResult,
      }),
      demoLoadWarning: buildDemoLoadWarning(state),
    };
  }, [state, persistenceHealth, backupValidationResult]);
}
