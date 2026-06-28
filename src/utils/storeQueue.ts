// Shared load-dedup and write-serialization machinery for persisted zustand
// stores. Same pattern the quiz/session/spaced-rep stores use: dedupe
// concurrent first-load calls and serialize writes against loads so a
// resolving load can't stomp a just-persisted write.
export interface StoreQueue {
  /** Serialize an operation behind everything already queued. */
  enqueue: (operation: () => Promise<void>) => Promise<void>;
  /** Run a load, deduping concurrent callers onto the same in-flight promise. */
  runLoad: (load: () => Promise<void>) => Promise<void>;
  /** Test-only: drop any in-flight promises. */
  reset: () => void;
}

export function createStoreQueue(): StoreQueue {
  let loadPromise: Promise<void> | null = null;
  let operationQueue: Promise<void> = Promise.resolve();

  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    const next = operationQueue.catch(() => undefined).then(operation);
    operationQueue = next.catch(() => undefined);
    return next;
  };

  const runLoad = (load: () => Promise<void>): Promise<void> => {
    if (loadPromise) return loadPromise;
    const attempt = enqueue(load);
    const wrapped: Promise<void> = attempt.finally(() => {
      if (loadPromise === wrapped) loadPromise = null;
    });
    loadPromise = wrapped;
    return wrapped;
  };

  return {
    enqueue,
    runLoad,
    reset: () => {
      loadPromise = null;
      operationQueue = Promise.resolve();
    },
  };
}

/** Parse a persisted JSON string array, dropping anything that isn't a string. */
export function parseStoredStringArray(stored: string | null): string[] {
  if (!stored) return [];
  const parsed = JSON.parse(stored);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((v): v is string => typeof v === 'string');
}
