export function useSetupChecklistActions({ appSettings, setSetting }) {
  const setSetupChecklistOverride = (itemKey, status) => {
    const key = String(itemKey || "").trim();
    if (!key) return;
    const nextOverrides = { ...(appSettings.setupChecklistOverrides || {}) };
    if (status === "not_applicable" || status === "dismissed") {
      nextOverrides[key] = { status, updatedAt: new Date().toISOString() };
    } else {
      delete nextOverrides[key];
    }
    setSetting("setupChecklistOverrides", nextOverrides);
  };

  const toggleSetupChecklistShowFull = () => {
    setSetting("setupChecklistShowCompleted", !appSettings.setupChecklistShowCompleted);
  };

  return {
    setSetupChecklistOverride,
    toggleSetupChecklistShowFull,
  };
}
