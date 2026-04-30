"use client";

import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { LogOut, UserRound } from "lucide-react";

type AuthStatusProps = {
  userName?: string;
  userEmail?: string;
  onSignIn: () => void;
};

export function AuthStatus({ userName, userEmail, onSignIn }: AuthStatusProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (isLoading) {
    return (
      <div className="h-8 w-20 animate-pulse rounded-full border border-border bg-card shadow-sm" aria-hidden />
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-secondary"
      >
        <UserRound className="size-3.5" />
        Sign in
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-2 pr-1 shadow-sm">
      <UserRound className="size-3.5 text-accent" />
      <span className="max-w-24 truncate text-xs font-medium">{userName || userEmail || "Wandr"}</span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Sign out"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}
