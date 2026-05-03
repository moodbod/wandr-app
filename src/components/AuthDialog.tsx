"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

type AuthDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

type AuthFlow = "signIn" | "signUp";
type PendingFlow = AuthFlow | "google" | null;

export function AuthDialog({ open, onClose, onSubmitted }: AuthDialogProps) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<AuthFlow>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFlow>(null);

  if (!open) {
    return null;
  }

  const title = flow === "signIn" ? "Sign in to keep going" : "Create your Wandr account";
  const isPending = pending !== null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(flow);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("flow", flow);
      await signIn("password", formData);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setPending("google");

    try {
      const redirectTo = `${window.location.pathname}${window.location.search}`;
      const result = await signIn("google", { redirectTo });

      if (result.signingIn) {
        onSubmitted();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign-in. Please try again.");
      setPending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-foreground/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Close sign in" />
      <div className="relative w-full max-w-sm rounded-t-[1.75rem] border border-border bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl animate-in slide-in-from-bottom-6 duration-300 sm:rounded-2xl sm:pb-5 sm:zoom-in-95">
        <div className="absolute left-1/2 top-2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-muted sm:hidden" />
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-accent">Wandr account</div>
            <h2 className="mt-1 text-xl font-semibold leading-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isPending}
          className="mb-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending === "google" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <span className="grid size-4 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background" aria-hidden>
              G
            </span>
          )}
          Continue with Google
        </button>

        <div className="mb-4 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-xl border border-input bg-background px-3 py-3 text-[16px] font-normal outline-none focus:ring-2 focus:ring-ring sm:text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={flow === "signIn" ? "current-password" : "new-password"}
              className="rounded-xl border border-input bg-background px-3 py-3 text-[16px] font-normal outline-none focus:ring-2 focus:ring-ring sm:text-sm"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending === flow ? <Loader2 className="size-4 animate-spin" /> : null}
            {flow === "signIn" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            setFlow((current) => (current === "signIn" ? "signUp" : "signIn"));
          }}
          className="mt-4 w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70"
        >
          {flow === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
