"use client";

import { useMutation } from "convex/react";
import { Check, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";

type OnboardingDialogProps = {
  open: boolean;
  onComplete: () => void;
};

const preferences = [
  { id: "eat", label: "Food" },
  { id: "see", label: "Landmarks" },
  { id: "gems", label: "Hidden gems" },
  { id: "routes", label: "Routes" },
];

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [selected, setSelected] = useState<string[]>(["eat", "gems"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return null;
  }

  const togglePreference = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);

    try {
      await completeOnboarding({
        name: String(formData.get("name") ?? ""),
        homeCity: String(formData.get("homeCity") ?? ""),
        travelPreferences: selected,
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save onboarding. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-t-3xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-accent">New here</div>
          <h2 className="mt-1 text-xl font-semibold leading-tight">Set up your Wandr profile</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Name
            <input
              name="name"
              type="text"
              required
              autoComplete="name"
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Home city
            <input
              name="homeCity"
              type="text"
              required
              autoComplete="address-level2"
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Travel preferences</div>
            <div className="grid grid-cols-2 gap-2">
              {preferences.map((preference) => {
                const active = selected.includes(preference.id);
                return (
                  <button
                    key={preference.id}
                    type="button"
                    onClick={() => togglePreference(preference.id)}
                    className={[
                      "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-secondary",
                    ].join(" ")}
                  >
                    {active ? <Check className="size-4" /> : null}
                    {preference.label}
                  </button>
                );
              })}
            </div>
          </div>

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
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
