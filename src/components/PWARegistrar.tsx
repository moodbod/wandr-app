"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type StandaloneNavigator = Navigator & { standalone?: boolean };

export function PWARegistrar() {
  const pathname = usePathname();

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as StandaloneNavigator).standalone === true);
    const shouldLockExplore = isStandalone && pathname === "/";

    document.documentElement.classList.toggle("is-standalone-pwa", isStandalone);
    document.documentElement.classList.toggle("is-standalone-explore", shouldLockExplore);
    document.body.classList.toggle("is-standalone-explore", shouldLockExplore);

    return () => {
      document.documentElement.classList.remove("is-standalone-explore");
      document.body.classList.remove("is-standalone-explore");
    };
  }, [pathname]);

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

    void registerServiceWorker();
  }, []);

  return null;
}
