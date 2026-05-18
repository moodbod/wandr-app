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
  Globe,
  Utensils,
  Landmark,
  Gem,
  Map as MapIcon,
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
  { id: "eat", label: "Food", icon: Utensils },
  { id: "see", label: "Landmarks", icon: Landmark },
  { id: "gems", label: "Hidden gems", icon: Gem },
  { id: "routes", label: "Routes", icon: MapIcon },
];

const statusLabels = {
  planning: "Planning",
  active: "Active",
  completed: "Completed",
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

function SettingsRow({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={last ? "" : "border-b border-[#efefef]"}>
      <div className="flex min-h-[72px] w-full items-center justify-between gap-4 py-4 px-4 sm:px-8 transition-colors rounded-2xl hover:bg-[#f9f9f9]">
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 mt-8 px-4 sm:px-8">
      <h2 className="text-[24px] font-bold tracking-tight text-black">{title}</h2>
      {subtitle && <p className="mt-1 text-[16px] leading-relaxed text-[#5e5e5e]">{subtitle}</p>}
    </div>
  );
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
    if (!currentUser) return;
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
    setLiveLocationPreference({ enabled: checked, prompted: !checked });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    try {
      await updateSettings({ name, homeCountry, travelPreferences: selectedPreferences });
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
    <main className="min-h-dvh bg-white text-black font-sans antialiased">
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-md flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center px-4 sm:px-8 bg-white/90 backdrop-blur-xl">
          <Link href="/" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f3f3f3] hover:bg-[#e2e2e2] transition-colors active:scale-95" aria-label="Back to Wandr">
            <ArrowLeft className="size-[20px]" />
          </Link>
        </header>

        {/* Scrollable Content */}
        <div className="flex flex-1 flex-col pb-[max(6rem,calc(4rem+env(safe-area-inset-bottom)+2rem))] lg:pb-[max(2rem,env(safe-area-inset-bottom))]">
          
          <div className="px-4 sm:px-8 pt-2 pb-8">
            <h1 className="text-[36px] font-bold tracking-tight text-black">Settings</h1>
          </div>

          {/* Profile Card */}
          {isLoadingAccount ? (
            <div className="px-4 sm:px-8 mb-8">
              <div className="flex items-center gap-4">
                <div className="size-[72px] shrink-0 animate-pulse rounded-full bg-[#efefef]" />
                <div className="flex flex-col gap-2">
                  <div className="h-6 w-32 animate-pulse rounded-full bg-[#efefef]" />
                  <div className="h-4 w-48 animate-pulse rounded-full bg-[#efefef]" />
                </div>
              </div>
            </div>
          ) : !isAuthenticated ? (
            <section className="px-4 sm:px-8 mb-8">
              <div className="flex flex-col gap-5 rounded-[16px] bg-[#f3f3f3] p-6 text-center items-center">
                <div className="grid size-16 shrink-0 place-items-center rounded-full bg-black text-white">
                  <UserRound className="size-8 text-white" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-[24px] font-bold tracking-tight">Sign in to Wandr</h2>
                  <p className="text-[16px] leading-relaxed text-[#5e5e5e] max-w-[280px] mx-auto">
                    Save trips, sync preferences, and pick up where you left off on any device.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-black px-8 text-[16px] font-bold text-white transition-transform hover:bg-black/90 active:scale-95 w-full sm:w-auto mt-2"
                >
                  Sign in
                </button>
              </div>
            </section>
          ) : currentUser ? (
            <section className="px-4 sm:px-8 mb-8 flex items-center gap-5">
              <div className="grid size-[72px] shrink-0 place-items-center rounded-full bg-[#f3f3f3] text-3xl font-bold text-black">
                {(currentUser.name ?? "W").charAt(0).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[24px] font-bold tracking-tight text-black">
                  {currentUser.name ?? "Wanderer"}
                </span>
                <span className="truncate text-[16px] text-[#5e5e5e]">
                  {currentUser.email ?? "No email"}
                </span>
              </div>
              {currentUser.role === "admin" && (
                <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-white">
                  Admin
                </span>
              )}
            </section>
          ) : null}

          {/* General settings */}
          <div className="border-t border-[#efefef]">
            <SectionHeader title="General" />
            <div className="flex flex-col">
              <SettingsRow last={!(isAuthenticated && currentUser?.role === "admin")}>
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="grid size-[32px] shrink-0 place-items-center rounded-full bg-[#f3f3f3] text-black">
                    <MapPin className="size-[16px]" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-[16px] font-bold text-black">Live location</span>
                    <span className="truncate text-[14px] text-[#5e5e5e]">Show your position on the map</span>
                  </div>
                </div>
                <Switch
                  checked={liveLocationPreference.enabled}
                  onCheckedChange={handleLiveLocationChange}
                  aria-label="Show live location"
                />
              </SettingsRow>

              {isAuthenticated && currentUser?.role === "admin" && (
                <SettingsRow last>
                  <Link href="/admin" className="flex flex-1 items-center justify-between outline-none group">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="grid size-[32px] shrink-0 place-items-center rounded-full bg-[#f3f3f3] text-black">
                        <ShieldCheck className="size-[16px]" />
                      </div>
                      <span className="truncate text-[16px] font-bold text-black group-hover:underline">Admin panel</span>
                    </div>
                    <ChevronRight className="size-5 text-[#afafaf]" />
                  </Link>
                </SettingsRow>
              )}
            </div>
          </div>

          {/* Offline maps & guides */}
          <div className="border-t border-[#efefef] mt-4 pt-4">
            <div className="px-4 sm:px-8">
              <OfflineDownloads />
            </div>
          </div>

          {/* Travel profile (authenticated) */}
          {isAuthenticated && currentUser && (
            <div className="border-t border-[#efefef] mt-8">
              <SectionHeader title="Travel profile" subtitle="Personalise your experience" />
              <form onSubmit={handleSubmit} className="flex flex-col">
                <SettingsRow>
                  <label className="flex w-full flex-col gap-2">
                    <span className="text-[14px] font-bold text-[#5e5e5e]">Name</span>
                    <input
                      value={name}
                      onChange={(event) => { setSaved(false); setName(event.target.value); }}
                      type="text"
                      required
                      autoComplete="name"
                      className="min-h-[48px] w-full rounded-[8px] bg-[#f3f3f3] px-4 text-[16px] font-medium text-black outline-none focus:ring-2 focus:ring-black placeholder:text-[#afafaf]"
                      placeholder="Your name"
                    />
                  </label>
                </SettingsRow>

                <SettingsRow>
                  <label className="flex w-full flex-col gap-2">
                    <span className="text-[14px] font-bold text-[#5e5e5e]">Home country</span>
                    <input
                      value={homeCountry}
                      onChange={(event) => { setSaved(false); setHomeCountry(event.target.value); }}
                      type="text"
                      required
                      autoComplete="country-name"
                      className="min-h-[48px] w-full rounded-[8px] bg-[#f3f3f3] px-4 text-[16px] font-medium text-black outline-none focus:ring-2 focus:ring-black placeholder:text-[#afafaf]"
                      placeholder="Where you're from"
                    />
                  </label>
                </SettingsRow>

                <SettingsRow last>
                  <div className="flex w-full flex-col gap-3 py-2">
                    <span className="text-[14px] font-bold text-[#5e5e5e]">Interests</span>
                    <div className="flex flex-wrap gap-3">
                      {preferenceOptions.map((preference) => {
                        const active = selectedPreferences.includes(preference.id);
                        return (
                          <button
                            key={preference.id}
                            type="button"
                            onClick={() => togglePreference(preference.id)}
                            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2 text-[16px] font-bold transition-colors active:scale-95 ${
                              active ? "bg-black text-white hover:bg-black/90" : "bg-[#f3f3f3] text-black hover:bg-[#e2e2e2]"
                            }`}
                          >
                            <preference.icon className="size-[16px]" />
                            {preference.label}
                            {active && <Check className="size-[16px]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </SettingsRow>

                {error && (
                  <div className="mx-4 sm:mx-8 mt-4 rounded-[8px] bg-red-50 p-4 text-[16px] font-medium text-red-600">
                    {error}
                  </div>
                )}

                <div className="p-4 sm:px-8 mt-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-black px-6 text-[16px] font-bold text-white transition-transform hover:bg-black/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {pending ? <Loader2 className="size-5 animate-spin" /> : null}
                    {saved ? (
                      <>
                        <CircleCheck className="size-5" />
                        Saved
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Trip plans (authenticated) */}
          {isAuthenticated && (
            <div className="border-t border-[#efefef] mt-8">
              <SectionHeader title="Trip plans" subtitle="Your saved routes and itineraries" />
              {isLoadingTrips ? (
                <div className="flex flex-col">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-[96px] w-full animate-pulse border-b border-[#efefef] bg-white last:border-0" />
                  ))}
                </div>
              ) : tripPlans && tripPlans.length > 0 ? (
                <div className="flex flex-col">
                  {tripPlans.map(({ trip, stops }, index) => {
                    const destination = destinationById.get(trip.destinationId);
                    const href = `/?destination=${encodeURIComponent(trip.destinationId)}`;
                    const visibleStops = stops
                      .slice(0, 2)
                      .map((stop) => destination?.spots.find((spot) => spot.id === stop.spotId)?.name ?? "Saved stop");
                    const isLast = index === tripPlans.length - 1;

                    return (
                      <div key={trip._id} className={isLast ? "" : "border-b border-[#efefef]"}>
                        <Link
                          href={href}
                          className="flex items-center gap-4 py-5 px-4 sm:px-8 transition-colors rounded-2xl hover:bg-[#f9f9f9] active:bg-[#efefef]"
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="truncate text-[18px] font-bold text-black">
                                {destination ? `${destination.city}, ${destination.country}` : trip.destinationId}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider ${
                                trip.status === "active" ? "bg-black text-white" : 
                                trip.status === "planning" ? "bg-[#efefef] text-[#5e5e5e]" : 
                                "border border-[#efefef] bg-transparent text-[#5e5e5e]"
                              }`}>
                                {statusLabels[trip.status]}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] font-medium text-[#5e5e5e]">
                              <span className="flex items-center gap-1.5">
                                <MapPin className="size-4" />
                                {stops.length} stop{stops.length === 1 ? "" : "s"}
                              </span>
                              <span className="flex items-center gap-1.5">
                                {trip.routeMode === "walk" ? <Footprints className="size-4" /> : <Route className="size-4" />}
                                <span className="capitalize">{trip.routeMode}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock3 className="size-4" />
                                {formatUpdatedAt(trip.updatedAt)}
                              </span>
                            </div>
                            {visibleStops.length > 0 && (
                              <p className="mt-1 truncate text-[14px] text-[#afafaf]">
                                {visibleStops.join(", ")}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="size-6 shrink-0 text-[#afafaf] transition-transform group-hover:translate-x-1" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
                  <div className="grid size-[64px] place-items-center rounded-full bg-[#f3f3f3]">
                    <Globe className="size-8 text-[#afafaf]" />
                  </div>
                  <h3 className="text-[20px] font-bold tracking-tight text-black">No trips yet</h3>
                  <p className="mx-auto max-w-[280px] text-[16px] text-[#5e5e5e]">
                    Build a route from the map and your plans will appear here.
                  </p>
                  <Link href="/" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-black px-6 text-[16px] font-bold text-white transition-transform hover:bg-black/90 active:scale-95 mt-2">
                    Start planning
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Account actions */}
          {isAuthenticated && currentUser && (
            <div className="border-t border-[#efefef] mt-8 py-8">
              <div className="px-4 sm:px-8">
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#f3f3f3] px-6 text-[16px] font-bold text-black transition-colors hover:bg-[#e2e2e2] active:scale-95 sm:w-auto"
                >
                  <LogOut className="size-5" />
                  Sign out
                </button>
              </div>
            </div>
          )}

          <div className="h-12" />
        </div>
      </div>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onSubmitted={() => setAuthOpen(false)} />
    </main>
  );
}


