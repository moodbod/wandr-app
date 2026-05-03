"use client";

import { useEffect } from "react";

type StandaloneNavigator = Navigator & { standalone?: boolean };

export function PWARegistrar() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as StandaloneNavigator).standalone === true);

    document.documentElement.classList.toggle("is-standalone-pwa", isStandalone);

    return () => {
      document.documentElement.classList.remove("is-standalone-pwa");
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
