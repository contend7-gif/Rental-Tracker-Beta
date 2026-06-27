export function createDesktopSaveQueue({ saveSnapshot, onSuccess, onError } = {}) {
  let inFlight = false;
  let pending = false;
  let latestSnapshot = null;
  let lastResult = { ok: true };
  let flushWaiters = [];

  const notifyFlushWaiters = () => {
    if (inFlight || pending) return;
    const waiters = flushWaiters;
    flushWaiters = [];
    waiters.forEach((resolve) => resolve(lastResult));
  };

  const run = async () => {
    if (inFlight || !latestSnapshot) {
      notifyFlushWaiters();
      return;
    }

    inFlight = true;
    pending = false;
    const snapshot = latestSnapshot;

    try {
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
