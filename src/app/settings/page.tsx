"use client";

import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Footprints,
  Loader2,
  LogOut,
  MapPin,
  Route,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../../../convex/_generated/api";
import { AuthDialog } from "@/components/AuthDialog";
import type { Destination } from "@/data/destinations";

const preferenceOptions = [
  { id: "eat", label: "Food" },
  { id: "see", label: "Landmarks" },
  { id: "gems", label: "Hidden gems" },
  { id: "routes", label: "Routes" },
] as const;

const statusLabels = {
  planning: "Planning",
  active: "Active",
  completed: "Completed",
} as const;

const statusClasses = {
  planning: "bg-accent/10 text-accent ring-accent/25",
  active: "bg-highlight/10 text-highlight ring-highlight/25",
  completed: "bg-secondary text-muted-foreground ring-border",
} as const;

function formatUpdatedAt(updatedAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(updatedAt));
}

function isDestinationList(value: unknown): value is Destination[] {
  return Array.isArray(value) && value.every((destination) => {
    if (!destination || typeof destination !== "object") {
      return false;
    }

    const candidate = destination as Partial<Destination>;
    return typeof candidate.id === "string" && Array.isArray(candidate.spots);
  });
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const catalogData = useQuery(api.content.listPublic, {});
  const destinations = useMemo(() => (isDestinationList(catalogData) ? catalogData : []), [catalogData]);
  const tripPlans = useQuery(api.trips.listForCurrentUser, isAuthenticated ? {} : "skip");
  const updateSettings = useMutation(api.users.updateSettings);
  const [authOpen, setAuthOpen] = useState(false);
  const [name, setName] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setName(currentUser.name ?? "");
    setHomeCountry(currentUser.homeCountry ?? currentUser.homeCity ?? "");
    setSelectedPreferences(currentUser.travelPreferences ?? []);
  }, [currentUser]);

  const destinationById = useMemo(
    () => new Map(destinations.map((destination) => [destination.id, destination])),
    [destinations],
  );

  const togglePreference = (id: string) => {
    setSaved(false);
    setSelectedPreferences((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    try {
      await updateSettings({
        name,
        homeCountry,
        travelPreferences: selectedPreferences,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const isLoadingAccount = authLoading || (isAuthenticated && currentUser === undefined);
  const isLoadingTrips = isAuthenticated && tripPlans === undefined;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-background/90 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-6">
          <Link
            href="/"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/70 bg-white/95 shadow-sm transition-transform active:scale-95"
            aria-label="Back to Wandr"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-semibold">Settings</h1>
            <p className="truncate text-xs text-muted-foreground">Profile, trips, and account</p>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-white/70 bg-white/95 px-3 text-xs font-medium shadow-sm transition-transform active:scale-95"
          >
            Map
          </Link>
        </header>

        <div className="flex flex-1 flex-col gap-8 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pt-5">
          <section>
            <h2 className="text-3xl font-black leading-none tracking-[-0.04em]">Your Wandr</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Tune the basics and jump back into the trips you have started.
            </p>
          </section>

        {isLoadingAccount ? (
          <div className="rounded-[1.35rem] bg-white/80 p-5 shadow-sm">
            <div className="h-5 w-36 animate-pulse rounded-full bg-muted" />
            <div className="mt-3 h-4 w-64 max-w-full animate-pulse rounded-full bg-muted" />
          </div>
        ) : !isAuthenticated ? (
          <section className="rounded-[1.5rem] bg-foreground p-5 text-background shadow-xl shadow-foreground/15">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <UserRound className="size-4" />
                  Wandr account
                </div>
                <p className="mt-2 text-sm leading-relaxed text-background/75">
                  Sign in to edit your profile and see saved trip plans.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
              >
                Sign in
              </button>
            </div>
          </section>
        ) : currentUser ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <section>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Travel profile</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    The same details you set during onboarding.
                  </p>
                </div>
                {saved ? (
                  <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-highlight/10 px-3 py-1 text-xs font-medium text-highlight">
                    <CircleCheck className="size-3.5" />
                    Saved
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  <span>Name</span>
                  <input
                    value={name}
                    onChange={(event) => {
                      setSaved(false);
                      setName(event.target.value);
                    }}
                    type="text"
                    required
                    autoComplete="name"
                    className="min-h-12 rounded-2xl border border-transparent bg-white/90 px-4 text-[16px] font-normal shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:text-sm"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  <span>Home country</span>
                  <input
                    value={homeCountry}
                    onChange={(event) => {
                      setSaved(false);
                      setHomeCountry(event.target.value);
                    }}
                    type="text"
                    required
                    autoComplete="country-name"
                    className="min-h-12 rounded-2xl border border-transparent bg-white/90 px-4 text-[16px] font-normal shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:text-sm"
                  />
                </label>

                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium">Travel preferences</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {preferenceOptions.map((preference) => {
                      const active = selectedPreferences.includes(preference.id);
                      return (
                        <button
                          key={preference.id}
                          type="button"
                          onClick={() => togglePreference(preference.id)}
                          className={[
                            "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium shadow-sm transition-colors",
                            active
                              ? "bg-foreground text-background"
                              : "bg-white/90 text-foreground hover:bg-white",
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
                  <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save settings
                </button>
              </form>
            </section>

            <section className="rounded-[1.5rem] bg-white/80 p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Account</h2>
              <div className="mt-4 divide-y divide-border/70 text-sm">
                <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                  <span className="text-muted-foreground">Email</span>
                  <span className="min-w-0 truncate font-medium">{currentUser.email ?? "No email saved"}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-muted-foreground">Profile</span>
                  <span className="font-medium">
                    {currentUser.onboardingCompleted ? "Onboarding complete" : "Needs onboarding"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-muted-foreground">Access</span>
                  <span className="font-medium">{currentUser.role === "admin" ? "Admin" : "Traveler"}</span>
                </div>
              </div>
              {currentUser.role === "admin" ? (
                <Link
                  href="/admin"
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                >
                  <ShieldCheck className="size-4" />
                  Admin
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-background px-4 text-sm font-semibold text-destructive transition-colors hover:bg-secondary"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </section>
          </div>
        ) : null}

        {isAuthenticated ? (
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Trip plans</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your latest saved routes.
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex min-h-10 w-fit items-center justify-center rounded-full bg-white/90 px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-white"
              >
                Open planner
              </Link>
            </div>

            <div className="mt-5">
              {isLoadingTrips ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-20 animate-pulse rounded-[1.35rem] bg-muted" />
                  ))}
                </div>
              ) : tripPlans && tripPlans.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {tripPlans.map(({ trip, stops }) => {
                    const destination = destinationById.get(trip.destinationId);
                    const href = `/?destination=${encodeURIComponent(trip.destinationId)}`;
                    const visibleStops = stops
                      .slice(0, 2)
                      .map((stop) => destination?.spots.find((spot) => spot.id === stop.spotId)?.name ?? "Saved stop");

                    return (
                      <Link
                        key={trip._id}
                        href={href}
                        className="group flex flex-col gap-3 rounded-[1.35rem] bg-white/85 p-4 shadow-sm transition-transform active:scale-[0.99] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold">
                              {destination ? `${destination.city}, ${destination.country}` : trip.destinationId}
                            </span>
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                                statusClasses[trip.status],
                              ].join(" ")}
                            >
                              {statusLabels[trip.status]}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3.5" />
                              {stops.length} stop{stops.length === 1 ? "" : "s"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              {trip.routeMode === "walk" ? <Footprints className="size-3.5" /> : <Route className="size-3.5" />}
                              {trip.routeMode}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="size-3.5" />
                              {formatUpdatedAt(trip.updatedAt)}
                            </span>
                          </div>
                          {visibleStops.length > 0 ? (
                            <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                              {visibleStops.join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <ChevronRight className="hidden size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[1.5rem] bg-white/80 p-6 text-center shadow-sm">
                  <h3 className="text-base font-semibold">No saved trips yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Build a route from the map and your plans will appear here.
                  </p>
                  <Link
                    href="/"
                    className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                  >
                    Start planning
                  </Link>
                </div>
              )}
            </div>
          </section>
        ) : null}
        </div>
      </div>

      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSubmitted={() => setAuthOpen(false)}
      />
    </main>
  );
}
