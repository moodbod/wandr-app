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
      <header className={`absolute left-0 right-0 top-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))] pointer-events-none ${!isRootRoute ? "hidden" : ""}`}>
        {/* Mobile Header */}
        <div className="sm:hidden">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="size-10 shrink-0 rounded-full bg-white/95 border border-white/70 backdrop-blur-xl animate-pulse" />
            <div className="flex gap-2">
              <div className="h-10 w-24 rounded-full bg-white/95 border border-white/70 backdrop-blur-xl animate-pulse" />
              <div className="size-10 rounded-full bg-white/95 border border-white/70 backdrop-blur-xl animate-pulse" />
            </div>
          </div>
        </div>

        {/* Desktop Header Layout */}
        <div className="hidden sm:flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="h-8 w-24 bg-card/95 rounded-full animate-pulse" />
            <div className="size-10 rounded-full bg-card/95 animate-pulse" />
          </div>
          
          <div className="mx-auto w-full max-w-2xl">
             <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur-md h-12 animate-pulse" />
             <div className="mt-3 flex gap-1.5 overflow-hidden">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-9 w-20 rounded-full bg-card/95 border border-border animate-pulse shrink-0" />
                ))}
             </div>
          </div>
        </div>
      </header>

      {/* Bottom Card Skeleton */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 sm:px-6 sm:pb-6 pointer-events-none ${!isRootRoute ? "hidden" : ""}`}>
        <div className="mx-auto flex w-[calc(100%-1rem)] max-w-[24.5rem] flex-col sm:w-full sm:max-w-2xl">
          <div className="overflow-hidden rounded-t-[2rem] bg-card px-2 pb-8 pt-2.5 shadow-2xl sm:rounded-2xl sm:p-6 animate-pulse">
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
