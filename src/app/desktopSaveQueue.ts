export type DesktopSaveResult = {
  ok?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type DesktopSaveQueue<TSnapshot> = {
  enqueue: (snapshot: TSnapshot) => void;
  flush: () => Promise<DesktopSaveResult>;
};

type DesktopSaveQueueOptions<TSnapshot> = {
  saveSnapshot?: (snapshot: TSnapshot) => Promise<DesktopSaveResult | undefined>;
  onSuccess?: (result: DesktopSaveResult | undefined) => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export function createDesktopSaveQueue<TSnapshot = unknown>({ saveSnapshot, onSuccess, onError }: DesktopSaveQueueOptions<TSnapshot> = {}): DesktopSaveQueue<TSnapshot> {
  let inFlight = false;
  let pending = false;
  let latestSnapshot: TSnapshot | null = null;
  let lastResult: DesktopSaveResult = { ok: true };
  let flushWaiters: Array<(result: DesktopSaveResult) => void> = [];

  const notifyFlushWaiters = () => {
    if (inFlight || pending) return;
    const waiters = flushWaiters;
    flushWaiters = [];
    waiters.forEach((resolve) => resolve(lastResult));
  };

  const run = async (): Promise<void> => {
    if (inFlight || !latestSnapshot) {
      notifyFlushWaiters();
      return;
    }

    inFlight = true;
    pending = false;
    const snapshot = latestSnapshot;

    try {
      if (!saveSnapshot) throw new Error("SQLite save is unavailable.");
      const result = await saveSnapshot(snapshot);
      if (result?.ok === false) {
        throw new Error(result.message || "SQLite save failed.");
      }
      lastResult = result || { ok: true };
      await onSuccess?.(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "SQLite save failed.");
      lastResult = { ok: false, message };
      onError?.(error);
    } finally {
      inFlight = false;
      if (pending) {
        void run();
      } else {
        notifyFlushWaiters();
      }
    }
  };

  return {
    enqueue(snapshot) {
      latestSnapshot = snapshot;
      if (inFlight) {
        pending = true;
        return;
      }
      void run();
    },
    flush() {
      if (!inFlight && !pending) {
        return Promise.resolve(lastResult);
      }
      return new Promise((resolve) => {
        flushWaiters.push(resolve);
      });
    },
  };
}
