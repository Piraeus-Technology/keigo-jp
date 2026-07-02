type EndConnection = () => unknown | Promise<unknown>;

let activeRetainers = 0;
let endTimer: ReturnType<typeof setTimeout> | null = null;
let pendingEnd: Promise<void> | null = null;

function clearEndTimer() {
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
}

export function retainIapConnection() {
  activeRetainers += 1;
  clearEndTimer();
}

export function hasPendingIapEnd(): boolean {
  return pendingEnd !== null;
}

export async function waitForPendingIapEnd(): Promise<void> {
  if (pendingEnd) {
    await pendingEnd;
  }
}

export function releaseIapConnection(endConnection: EndConnection | undefined, delayMs = 250) {
  activeRetainers = Math.max(0, activeRetainers - 1);
  if (activeRetainers > 0 || !endConnection) return;

  clearEndTimer();
  endTimer = setTimeout(() => {
    endTimer = null;
    if (activeRetainers > 0) return;

    const currentEnd = Promise.resolve()
      .then(() => endConnection())
      .then(() => undefined)
      .catch(() => undefined);

    const finalEnd = currentEnd.finally(() => {
      if (pendingEnd === finalEnd) {
        pendingEnd = null;
      }
    });
    pendingEnd = finalEnd;
  }, delayMs);
}

export function __resetIapLifecycleForTests() {
  activeRetainers = 0;
  clearEndTimer();
  pendingEnd = null;
}
