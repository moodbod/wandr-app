"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";
import { useState, type ReactNode } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  if (!convex) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
            <div className="max-w-sm rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              <h1 className="mb-2 text-lg font-semibold text-foreground">Convex is not configured</h1>
              <p>
                Run <span className="font-medium text-foreground">bunx convex dev</span> to populate{" "}
                <span className="font-medium text-foreground">NEXT_PUBLIC_CONVEX_URL</span>.
              </p>
            </div>
          </main>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <ConvexAuthProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {children}
        </TooltipProvider>
      </QueryClientProvider>
    </ConvexAuthProvider>
  );
}
