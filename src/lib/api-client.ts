/**
 * Unified network fetch and action client
 * - 15-second timeout
 * - 1 automatic retry for GET requests ONLY
 * - Zero automatic retries for write actions (prevents duplicate operations)
 * - Poor-network detection (>8 seconds)
 * - Safe uniform error messages without leaking stack traces or database errors
 */

export interface ClientFetchOptions extends RequestInit {
  timeoutMs?: number;
  slowThresholdMs?: number;
  onSlow?: (isSlow: boolean) => void;
  retries?: number;
}

export class NetworkError extends Error {
  public isTimeout: boolean;
  public isOffline: boolean;

  constructor(message: string, { isTimeout = false, isOffline = false } = {}) {
    super(message);
    this.name = "NetworkError";
    this.isTimeout = isTimeout;
    this.isOffline = isOffline;
  }
}

export const NETWORK_MESSAGES = {
  offline: "No internet connection. Changes will not save until you reconnect.",
  slow: "Connection is slow. Still trying...",
  failed: "Could not connect. Check your connection and try again.",
  connectToSave: "Connect to save",
  backOnline: "Back online",
};

/**
 * Standard fetch with timeout, GET-only single retry, and slow-network monitoring
 */
export async function safeFetch(
  input: RequestInfo | URL,
  init?: ClientFetchOptions
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 15000;
  const slowThresholdMs = init?.slowThresholdMs ?? 8000;
  const method = (init?.method || "GET").toUpperCase();
  const isRead = method === "GET" || method === "HEAD";

  // Check offline state before initiating request
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new NetworkError(NETWORK_MESSAGES.failed, { isOffline: true });
  }

  // Attempt fetch with timeout and slow notification
  const executeOnce = async (attempt: number): Promise<Response> => {
    const controller = new AbortController();
    let isSlowNotified = false;

    // Timeout timer (15s)
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    // Slow network timer (8s)
    const slowTimer = setTimeout(() => {
      isSlowNotified = true;
      if (init?.onSlow) {
        init.onSlow(true);
      }
    }, slowThresholdMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      return response;
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      const isAborted = error.name === "AbortError";
      const isTimeout = isAborted;

      // Allow 1 retry for idempotent read requests only
      if (isRead && attempt === 0 && !isAborted) {
        // Short backoff before 1 single retry
        await new Promise((res) => setTimeout(res, 500));
        return executeOnce(1);
      }

      throw new NetworkError(NETWORK_MESSAGES.failed, {
        isTimeout,
        isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
      });
    } finally {
      clearTimeout(timeoutTimer);
      clearTimeout(slowTimer);
      if (isSlowNotified && init?.onSlow) {
        init.onSlow(false);
      }
    }
  };

  return executeOnce(0);
}

/**
 * Helper to wrap Server Actions with client-side timeout and slow detection
 */
export async function safeAction<T>(
  actionFn: () => Promise<T>,
  options?: {
    timeoutMs?: number;
    slowThresholdMs?: number;
    onSlow?: (isSlow: boolean) => void;
  }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const slowThresholdMs = options?.slowThresholdMs ?? 8000;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new NetworkError(NETWORK_MESSAGES.failed, { isOffline: true });
  }

  let slowTimer: NodeJS.Timeout | undefined;
  let isSlowNotified = false;

  const slowPromise = new Promise<never>((_, reject) => {
    slowTimer = setTimeout(() => {
      isSlowNotified = true;
      if (options?.onSlow) {
        options.onSlow(true);
      }
    }, slowThresholdMs);
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new NetworkError(NETWORK_MESSAGES.failed, { isTimeout: true }));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([actionFn(), timeoutPromise]);
    return result;
  } catch (err: unknown) {
    if (err instanceof NetworkError) {
      throw err;
    }
    // Never leak stack trace or internal error strings
    throw new NetworkError(NETWORK_MESSAGES.failed);
  } finally {
    if (slowTimer) clearTimeout(slowTimer);
    if (isSlowNotified && options?.onSlow) {
      options.onSlow(false);
    }
  }
}

