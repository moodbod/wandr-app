"use client";

import React from "react";
import { MapSkeleton } from "./MapSkeleton";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

export function ExploreLoadingSkeleton({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const isRootRoute = pathname === "/";
  return (
    <main className="wandr-native-map-shell text-foreground relative overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0">
        <MapSkeleton />
      </div>

      {/* Floating Header Skeleton */}
      <header className={`pointer-events-none absolute left-0 right-0 top-0 z-30 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-[max(1.5rem,env(safe-area-inset-top))] ${!isRootRoute ? "hidden" : ""}`}>
        {/* Mobile Header */}
        <div className="sm:hidden">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="size-11 shrink-0 animate-pulse rounded-full bg-card" />
            <div className="flex gap-2">
              <div className="h-11 w-28 animate-pulse rounded-full bg-card" />
              <div className="size-11 animate-pulse rounded-full bg-card" />
            </div>
          </div>
        </div>

        {/* Desktop Header Layout */}
        <div className="hidden sm:flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-24 animate-pulse rounded-full bg-card" />
            <div className="size-10 animate-pulse rounded-full bg-card" />
          </div>
          
          <div className="mx-auto w-full max-w-2xl">
             <div className="h-14 animate-pulse rounded-2xl bg-card ring-1 ring-border" />
             <div className="mt-3 flex gap-1.5 overflow-hidden">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-11 w-24 shrink-0 animate-pulse rounded-full bg-secondary" />
                ))}
             </div>
          </div>
        </div>
      </header>

      {/* Bottom Card Skeleton */}
      <div className={`pointer-events-none absolute bottom-[5.25rem] left-0 right-0 z-30 px-3 sm:bottom-0 sm:px-8 sm:pb-8 ${!isRootRoute ? "hidden" : ""}`}>
        <div className="mx-auto flex w-[calc(100%-1rem)] max-w-[24.5rem] flex-col sm:w-full sm:max-w-2xl">
          <div className="animate-pulse overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
            <div className="mx-auto mb-3 h-1.5 w-8 rounded-full bg-muted sm:hidden" />
            <div className="h-4 w-24 bg-muted/40 rounded mb-2" />
            <div className="h-8 w-48 bg-muted/60 rounded mb-4" />
            <div className="h-20 w-full bg-muted/20 rounded-xl" />
          </div>
        </div>
      </div>

      {children && (
        <div
          className="absolute inset-0 z-[100] bg-background overflow-y-auto"
          style={{ display: isRootRoute ? "none" : "block" }}
        >
          {children}
        </div>
      )}
    </main>
  );
}
