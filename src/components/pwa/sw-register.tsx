"use client";

import * as React from "react";

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      // If inside Capacitor Native App / WebView, unregister all Service Workers to prevent stale cache
      const isCapacitor =
        typeof (window as any).Capacitor !== "undefined" &&
        typeof (window as any).Capacitor.isNativePlatform === "function" &&
        (window as any).Capacitor.isNativePlatform();

      if (isCapacitor) {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
              registration.unregister();
            }
          });
        }
        if ("caches" in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              caches.delete(key);
            }
          });
        }
        return;
      }

      // In standard browsers, register service worker and force check for update
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
              registration.update();
            })
            .catch(() => {});
        });
      }
    }
  }, []);

  return null;
}
