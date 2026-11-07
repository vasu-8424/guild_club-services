"use client";

import * as React from "react";
import { Capacitor } from "@capacitor/core";

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // Configure Native Status Bar so it does not overlay webview
      import("@capacitor/status-bar")
        .then(({ StatusBar, Style }) => {
          StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
          StatusBar.setBackgroundColor({ color: "#FFFFFF" }).catch(() => {});
          StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        })
        .catch(() => {});

      // In Native Shell: Unregister ALL Service Workers & purge caches to ensure live site is loaded
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

    // On the Web (not native): Register network-first service worker
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
  }, []);

  return null;
}
