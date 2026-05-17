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

import { Switch } from "@/components/ui/switch";
import type { Destination } from "@/data/destinations";
import { useLiveLocationPreference } from "@/hooks/useUserLocation";
import { OfflineDownloads } from "@/components/OfflineDownloads";

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
  planning: "bg-secondary text-foreground ring-transparent",
  active: "bg-foreground text-background ring-transparent",
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
  const [liveLocationPreference, setLiveLocationPreference] = useLiveLocationPreference();

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

  const handleLiveLocationChange = (checked: boolean) => {
    setLiveLocationPreference({
      enabled: checked,
      prompted: !checked,
    });
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
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-background/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-8">
          <Link
            href="/"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-card ring-1 ring-border transition-colors hover:bg-secondary"
            aria-label="Back to Wandr"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-bold">Settings</h1>
            <p className="truncate text-xs text-muted-foreground">Profile, trips, and account</p>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-card px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-secondary"
          >
            Map
          </Link>
        </header>

        <div className="flex flex-1 flex-col gap-8 px-4 pb-[max(6rem,calc(4rem+env(safe-area-inset-bottom)+2rem))] pt-4 sm:px-8 sm:pt-6 lg:pb-[max(2rem,env(safe-area-inset-bottom))]">
          <section>
            <h2 className="text-4xl font-bold leading-[2.75rem] sm:text-5xl sm:leading-[3.75rem]">Your Wandr</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Tune the basics and jump back into the trips you have started.
            </p>
          </section>

          <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-base font-medium">
                  <MapPin className="size-4" />
                  Live location
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Show your position on the map.
                </p>
              </div>
              <Switch
                checked={liveLocationPreference.enabled}
                onCheckedChange={handleLiveLocationChange}
                aria-label="Show live location"
              />
            </div>
          </section>

          <OfflineDownloads />

        {isLoadingAccount ? (
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <div className="h-5 w-36 animate-pulse rounded-full bg-muted" />
            <div className="mt-3 h-4 w-64 max-w-full animate-pulse rounded-full bg-muted" />
          </div>
        ) : !isAuthenticated ? (
          <section className="rounded-2xl bg-foreground p-6 text-background">
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-2 text-base font-medium">
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
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-foreground transition-colors hover:bg-white/90"
              >
                Sign in
              </button>
            </div>
          </section>
        ) : currentUser ? (
          <div className="flex flex-col gap-8">
            <section>
              <div className="flex flex-col gap-3">
                <div>
                  <h2 className="text-2xl font-bold leading-8">Travel profile</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    The same details you set during onboarding.
                  </p>
                </div>
                {saved ? (
                  <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background">
                    <CircleCheck className="size-3.5" />
                    Saved
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
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
                    className="min-h-12 rounded-lg border border-transparent bg-secondary px-4 text-[16px] font-normal outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:text-sm"
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
                    className="min-h-12 rounded-lg border border-transparent bg-secondary px-4 text-[16px] font-normal outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:text-sm"
                  />
                </label>

                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium">Travel preferences</div>
                  <div className="flex flex-col gap-2">
                    {preferenceOptions.map((preference) => {
                      const active = selectedPreferences.includes(preference.id);
                      return (
                        <button
                          key={preference.id}
                          type="button"
                          onClick={() => togglePreference(preference.id)}
                          className={[
                            "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-foreground text-background"
                              : "bg-secondary text-foreground hover:bg-muted",
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
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-foreground/80 disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save settings
                </button>
              </form>
            </section>

            <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
              <h2 className="text-xl font-bold leading-7">Account</h2>
              <div className="mt-4 divide-y divide-border/70 text-sm">
                <div className="flex flex-col gap-1 py-3 first:pt-0">
                  <span className="text-muted-foreground">Email</span>
                  <span className="min-w-0 truncate font-medium">{currentUser.email ?? "No email saved"}</span>
                </div>
                <div className="flex flex-col gap-1 py-3">
                  <span className="text-muted-foreground">Profile</span>
                  <span className="font-medium">
                    {currentUser.onboardingCompleted ? "Onboarding complete" : "Needs onboarding"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 py-3">
                  <span className="text-muted-foreground">Access</span>
                  <span className="font-medium">{currentUser.role === "admin" ? "Admin" : "Traveler"}</span>
                </div>
              </div>
              {currentUser.role === "admin" ? (
                <Link
                  href="/admin"
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
                >
                  <ShieldCheck className="size-4" />
                  Admin
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </section>
          </div>
        ) : null}

        {isAuthenticated ? (
          <section>
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-2xl font-bold leading-8">Trip plans</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your latest saved routes.
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-secondary px-5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Open planner
              </Link>
            </div>

            <div className="mt-5">
              {isLoadingTrips ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-20 animate-pulse rounded-2xl bg-muted" />
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
                        className="group flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border transition-colors hover:ring-foreground/20 active:bg-secondary"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold">
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
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl bg-card p-6 text-center ring-1 ring-border">
                  <h3 className="text-xl font-bold leading-7">No saved trips yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Build a route from the map and your plans will appear here.
                  </p>
                  <Link
                    href="/"
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
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
