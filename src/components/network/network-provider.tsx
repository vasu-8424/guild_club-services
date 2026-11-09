"use client";

import * as React from "react";
import { Network } from "@capacitor/network";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface NetworkContextValue {
  isOnline: boolean;
  isSlow: boolean;
  showRestored: boolean;
  errorMessage: string | null;
  cancelHandler: (() => void) | null;
  retryHandler: (() => void) | null;
  setSlowState: (slow: boolean, onCancel?: () => void) => void;
  setErrorState: (msg: string | null, onRetry?: () => void) => void;
  clearError: () => void;
  handleCancelSlow: () => void;
  handleRetryError: () => void;
}

const NetworkContext = React.createContext<NetworkContextValue>({
  isOnline: true,
  isSlow: false,
  showRestored: false,
  errorMessage: null,
  cancelHandler: null,
  retryHandler: null,
  setSlowState: () => {},
  setErrorState: () => {},
  clearError: () => {},
  handleCancelSlow: () => {},
  handleRetryError: () => {},
});

export function useNetworkStatus() {
  return React.useContext(NetworkContext);
}

export function NetworkNoticeBanner() {
  const {
    isOnline,
    isSlow,
    showRestored,
    errorMessage,
    cancelHandler,
    retryHandler,
    handleCancelSlow,
    handleRetryError,
    clearError,
  } = useNetworkStatus();

  return (
    <>
      {!isOnline && (
        <div
          data-testid="offline-notice"
          role="status"
          aria-live="polite"
          className="w-full border-b border-amber-300 bg-amber-50 text-amber-950 px-4 py-2.5 text-xs font-medium flex items-center justify-between rounded-none shadow-xs select-none transition-all"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icons.WifiSlash size={16} className="text-amber-700 shrink-0" />
            <span className="leading-tight">
              No internet connection. Changes will not save until you reconnect.
            </span>
          </div>
        </div>
      )}

      {showRestored && isOnline && (
        <div
          data-testid="back-online-notice"
          role="status"
          aria-live="polite"
          className="w-full border-b border-emerald-300 bg-emerald-50 text-emerald-950 px-4 py-2.5 text-xs font-semibold flex items-center justify-between rounded-none shadow-xs select-none animate-fadeIn transition-all"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icons.Check size={16} className="text-emerald-700 shrink-0" />
            <span className="leading-tight">Back online</span>
          </div>
        </div>
      )}

      {isSlow && isOnline && (
        <div
          data-testid="slow-network-notice"
          role="status"
          aria-live="polite"
          className="w-full border-b border-amber-300 bg-amber-50 text-amber-950 px-4 py-2 text-xs font-medium flex items-center justify-between rounded-none shadow-xs select-none transition-all"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icons.WarningCircle size={16} className="text-amber-700 shrink-0" />
            <span className="leading-tight">Connection is slow. Still trying...</span>
          </div>
          {cancelHandler && (
            <button
              type="button"
              data-testid="slow-network-cancel-btn"
              onClick={handleCancelSlow}
              className="ml-3 shrink-0 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-900 border border-amber-400 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 rounded-none transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div
          data-testid="network-error-notice"
          role="alert"
          className="w-full border-b border-rose-300 bg-rose-50 text-rose-950 px-4 py-2 text-xs font-medium flex items-center justify-between rounded-none shadow-xs select-none transition-all"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icons.WarningCircle size={16} className="text-rose-700 shrink-0" />
            <span className="leading-tight">{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            {retryHandler && (
              <button
                type="button"
                data-testid="network-try-again-btn"
                onClick={handleRetryError}
                className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white bg-rose-700 hover:bg-rose-800 rounded-none transition-colors cursor-pointer"
              >
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={clearError}
              className="p-1 text-rose-700 hover:text-rose-900 cursor-pointer"
              aria-label="Dismiss error"
            >
              <Icons.Close size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [wasOffline, setWasOffline] = React.useState<boolean>(false);
  const [showRestored, setShowRestored] = React.useState<boolean>(false);

  // Slow request state
  const [isSlow, setIsSlow] = React.useState<boolean>(false);
  const [cancelHandler, setCancelHandler] = React.useState<(() => void) | null>(null);

  // Network error state
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [retryHandler, setRetryHandler] = React.useState<(() => void) | null>(null);

  React.useEffect(() => {
    // Initial check
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    // Capacitor Network plugin status check
    Network.getStatus()
      .then((status) => {
        setIsOnline(status.connected);
      })
      .catch(() => {
        // Fallback to browser navigator
      });

    let networkListenerHandle: { remove: () => void } | null = null;
    Network.addListener("networkStatusChange", (status) => {
      setIsOnline(status.connected);
    })
      .then((handle) => {
        networkListenerHandle = handle;
      })
      .catch(() => {});

    // Browser online/offline window listeners
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("app-online", handleOnline);
    window.addEventListener("app-offline", handleOffline);

    return () => {
      if (networkListenerHandle) {
        networkListenerHandle.remove();
      }
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("app-online", handleOnline);
      window.removeEventListener("app-offline", handleOffline);
    };
  }, []);

  // Show "Back online" briefly when transitioning from offline to online
  React.useEffect(() => {
    if (isOnline && wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
        setWasOffline(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  const setSlowState = React.useCallback((slow: boolean, onCancel?: () => void) => {
    setIsSlow(slow);
    setCancelHandler(slow && onCancel ? () => onCancel : null);
  }, []);

  const setErrorState = React.useCallback((msg: string | null, onRetry?: () => void) => {
    setErrorMessage(msg);
    setRetryHandler(msg && onRetry ? () => onRetry : null);
  }, []);

  const clearError = React.useCallback(() => {
    setErrorMessage(null);
    setRetryHandler(null);
  }, []);

  const handleCancelSlow = () => {
    if (cancelHandler) {
      cancelHandler();
    }
    setIsSlow(false);
    setCancelHandler(null);
  };

  const handleRetryError = () => {
    if (retryHandler) {
      const fn = retryHandler;
      clearError();
      fn();
    } else {
      clearError();
    }
  };

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isSlow,
        showRestored,
        errorMessage,
        cancelHandler,
        retryHandler,
        setSlowState,
        setErrorState,
        clearError,
        handleCancelSlow,
        handleRetryError,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}
