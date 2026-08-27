import { ipcMain } from "electron";
import { createCompanionSyncService } from "./companionSyncService.mjs";

export const COMPANION_CHANNELS = {
  status: "companion:status",
  configure: "companion:configure",
  disconnect: "companion:disconnect",
  list: "companion:list",
  syncPropertyCatalog: "companion:sync-property-catalog",
  claim: "companion:claim",
  download: "companion:download",
  complete: "companion:complete",
};

export function registerCompanionSyncIpc({ secretStore, recordDesktopHealthEvent } = {}) {
  const service = createCompanionSyncService({ secretStore });
  const handle = (channel, action) => {
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        return await action(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Mobile companion request failed.");
        recordDesktopHealthEvent?.("error", "Mobile companion request failed.", message);
        return { ok: false, message };
      }
    });
  };

  handle(COMPANION_CHANNELS.status, () => service.getStatus());
  handle(COMPANION_CHANNELS.configure, (payload) => service.configure(payload));
  handle(COMPANION_CHANNELS.disconnect, () => service.disconnect());
  handle(COMPANION_CHANNELS.list, () => service.list());
  handle(COMPANION_CHANNELS.syncPropertyCatalog, (payload) => service.syncPropertyCatalog(payload));
  handle(COMPANION_CHANNELS.claim, (payload) => service.claim(payload?.id));
  handle(COMPANION_CHANNELS.download, (payload) => service.download(payload?.id));
  handle(COMPANION_CHANNELS.complete, (payload) => service.complete(payload?.id));
  return service;
}
