"use client";

import { useEffect } from "react";

export function PWARegistrar() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);

    document.documentElement.classList.toggle("is-standalone-pwa", isStandalone);

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

    void registerServiceWorker();
  }, []);

  return null;
}
