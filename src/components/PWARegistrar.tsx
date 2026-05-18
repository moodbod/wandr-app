"use client";

import { useEffect } from "react";

type StandaloneNavigator = Navigator & { standalone?: boolean };

export function PWARegistrar() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as StandaloneNavigator).standalone === true);

    const isWindows = /Windows|Win32|Win64/i.test(navigator.userAgent);

    document.documentElement.classList.toggle("is-standalone-pwa", isStandalone);
    document.documentElement.classList.toggle("is-windows", isWindows);

    return () => {
      document.documentElement.classList.remove("is-standalone-pwa");
      document.documentElement.classList.remove("is-windows");
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
        await registration.update();
      } catch {
        // PWA support should never block the app shell.
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(() => void registerServiceWorker(), { timeout: 3000 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(() => void registerServiceWorker(), 2500);
    return () => globalThis.clearTimeout(timeoutId);
  }, []);

  return null;
}
