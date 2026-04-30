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

export function AuthDialog({ open, onClose, onSubmitted }: AuthDialogProps) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<AuthFlow>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return null;
  }

  const title = flow === "signIn" ? "Sign in to keep going" : "Create your Wandr account";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("flow", flow);
      await signIn("password", formData);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} aria-label="Close sign in" />
      <div className="relative w-full max-w-sm rounded-t-3xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-accent">Wandr account</div>
            <h2 className="mt-1 text-xl font-semibold leading-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
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
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {flow === "signIn" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setFlow((current) => (current === "signIn" ? "signUp" : "signIn"));
          }}
          className="mt-4 w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {flow === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
