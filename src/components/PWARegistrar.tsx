"use client";

import { useEffect } from "react";

export function PWARegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // PWA support should never block the app shell.
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
