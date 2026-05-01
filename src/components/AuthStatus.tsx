"use client";

import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { Facehash } from "facehash";
import { LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AuthStatusProps = {
  userName?: string;
  userEmail?: string;
  onSignIn: () => void;
};

export function AuthStatus({ userName, userEmail, onSignIn }: AuthStatusProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const avatarName = userName || userEmail || "Wandr";

  if (isLoading) {
    return (
      <div className="size-9 animate-pulse rounded-full border border-border bg-card shadow-sm" aria-hidden />
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${avatarName} account menu`}
        >
          <span className="grid size-7 place-items-center overflow-hidden rounded-full">
            <Facehash
              name={avatarName}
              size={28}
              variant="solid"
              intensity3d="subtle"
              className="text-foreground"
            />
          </span>
          <span className="max-w-24 truncate text-xs font-medium">{avatarName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href="/settings" className="gap-2">
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onSelect={() => void signOut()}
        >
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
