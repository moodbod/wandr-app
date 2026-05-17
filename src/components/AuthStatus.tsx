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
      <div className="size-10 animate-pulse rounded-full border border-border bg-card sm:size-10" aria-hidden />
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="inline-flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-foreground text-xs font-medium text-background transition-colors hover:bg-foreground/80 sm:h-10 sm:w-auto sm:px-4"
        aria-label="Sign in"
      >
        <UserRound className="size-3.5" />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-card p-0.5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-10 sm:w-auto sm:justify-start sm:pl-1 sm:pr-3"
          aria-label={`${avatarName} account menu`}
        >
          <span className="grid size-8 place-items-center overflow-hidden rounded-full sm:size-6">
            <Facehash
              name={avatarName}
              size={28}
              variant="solid"
              intensity3d="subtle"
              className="text-foreground"
            />
          </span>
          <span className="hidden max-w-24 truncate text-xs font-medium sm:inline">{avatarName}</span>
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
