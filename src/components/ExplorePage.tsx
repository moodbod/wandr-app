"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Search, Coffee, Eye, Sparkles, Route as RouteIcon, Clock, ArrowUpRight, Navigation } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { AuthDialog } from "@/components/AuthDialog";
import { AuthStatus } from "@/components/AuthStatus";
import DestinationPicker from "@/components/DestinationPicker";
import MapboxStreetsMap from "@/components/MapboxStreetsMap";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import RoutePanel from "@/components/RoutePanel";
import SpotModal from "@/components/SpotModal";
import { destinations, type Spot } from "@/data/destinations";

const categories = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "eat", label: "Eat", icon: Coffee },
  { id: "see", label: "See", icon: Eye },
  { id: "gems", label: "Hidden gems", icon: Sparkles },
  { id: "routes", label: "Routes", icon: RouteIcon },
] as const;

type GatedAction = () => void;

const ExplorePage = () => {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const [destination, setDestination] = useState(destinations[0]);
  const [activeCat, setActiveCat] = useState<(typeof categories)[number]["id"]>("all");
  const [nextStopId, setNextStopId] = useState<string | null>(destination.spots[0]?.id ?? null);
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState<"walk" | "drive">("walk");
  const [routeOpen, setRouteOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const pendingActionRef = useRef<GatedAction | null>(null);

  const visibleSpots = useMemo(
    () => destination.spots.filter((s) => activeCat === "all" || activeCat === "routes" || s.category === activeCat),
    [destination, activeCat]
  );

  const nextStop: Spot | undefined =
    destination.spots.find((s) => s.id === nextStopId) ?? destination.spots[0];
  const openSpot: Spot | null =
    destination.spots.find((s) => s.id === openSpotId) ?? null;

  const handleDestinationChange = (d: typeof destinations[number]) => {
    setDestination(d);
    setNextStopId(d.spots[0]?.id ?? null);
    setOpenSpotId(null);
    setRouteOpen(false);
  };

  const runGatedAction = useCallback(
    (action: GatedAction) => {
      if (authLoading) {
        pendingActionRef.current = action;
        return;
      }

      if (!isAuthenticated) {
        pendingActionRef.current = action;
        setAuthOpen(true);
        return;
      }

      if (currentUser === undefined) {
        pendingActionRef.current = action;
        return;
      }

      if (!currentUser?.onboardingCompleted) {
        pendingActionRef.current = action;
        setOnboardingOpen(true);
        return;
      }

      action();
    },
    [authLoading, currentUser, isAuthenticated]
  );

  useEffect(() => {
    if (authLoading || !isAuthenticated || currentUser === undefined) {
      return;
    }

    if (!currentUser?.onboardingCompleted) {
      setOnboardingOpen(true);
      return;
    }

    setOnboardingOpen(false);

    if (pendingActionRef.current === null) {
      return;
    }

    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    pendingAction();
  }, [authLoading, currentUser, isAuthenticated]);

  const handleOpenSpot = useCallback((spotId: string) => {
    runGatedAction(() => setOpenSpotId(spotId));
  }, [runGatedAction]);

  const handleOnboardingComplete = () => {
    setOnboardingOpen(false);
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Map */}
      <div className="absolute inset-0">
        <MapboxStreetsMap
          destination={destination}
          spots={visibleSpots}
          nextStop={nextStop}
          routeOpen={routeOpen}
          routeMode={routeMode}
          onOpenSpot={handleOpenSpot}
        />
        <div className="absolute inset-0 pointer-events-none bg-background/30" />
      </div>

      {/* Top */}
      <header className="absolute top-0 left-0 right-0 z-30 px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="relative flex flex-col gap-2 lg:min-h-28">
          <div className="flex items-center justify-between gap-3 lg:absolute lg:left-0 lg:right-0 lg:top-0">
            <h1 className="text-xl font-semibold tracking-tight lg:pt-1.5">
              Wandr<span className="text-accent">.</span>
            </h1>
            <div className="flex items-center gap-2">
              <DestinationPicker value={destination} onChange={handleDestinationChange} />
              <AuthStatus
                userName={currentUser?.name}
                userEmail={currentUser?.email}
                onSignIn={() => setAuthOpen(true)}
              />
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 lg:pt-0">
            <form
              className="bg-card rounded-full border border-border flex items-center gap-2 pl-4 pr-1.5 py-1.5 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                runGatedAction(() => undefined);
              }}
            >
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder={`I'm in ${destination.city}. What should I see?`}
                className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none py-1.5"
              />
              <button
                type="submit"
                className="bg-foreground text-background rounded-full px-4 py-1.5 text-xs font-medium hover:bg-foreground/90 transition-colors"
              >
                Ask
              </button>
            </form>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {categories.map((c) => {
                const isActive = activeCat === c.id;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={[
                      "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      isActive ? "bg-foreground text-background" : "bg-card text-foreground border border-border hover:bg-secondary",
                    ].join(" ")}
                  >
                    <Icon className="size-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-5 sm:px-6 sm:pb-6">
        <div className="mx-auto max-w-2xl flex flex-col gap-2.5">
          {nextStop && routeOpen ? (
            <RoutePanel
              spot={nextStop}
              mode={routeMode}
              onModeChange={(mode) => runGatedAction(() => setRouteMode(mode))}
              onClose={() => setRouteOpen(false)}
              onStart={() => runGatedAction(() => undefined)}
            />
          ) : nextStop ? (
            <>
              <div className="self-end bg-card border border-border rounded-full pl-2 pr-3 py-1.5 shadow-sm flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full bg-highlight" />
                <span className="font-medium">Next: {nextStop.name}</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3" /> {nextStop.walkMin} min
                </span>
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              </div>

              <button
                onClick={() => runGatedAction(() => setOpenSpotId(nextStop.id))}
                className="text-left bg-card rounded-2xl border border-border shadow-sm overflow-hidden hover:border-foreground/20 transition-colors"
              >
                <div className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[8rem_1fr]">
                  <img src={nextStop.image} alt={nextStop.name} className="h-full w-full object-cover" loading="lazy" />
                  <div className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wider text-accent">
                          {nextStop.tag}
                        </div>
                        <h2 className="text-lg font-semibold leading-tight mt-0.5">{nextStop.name}</h2>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-sm font-semibold tabular-nums">{nextStop.walkMin} min</span>
                        <span className="text-[11px] text-muted-foreground">walk</span>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">{nextStop.tip}</p>

                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        runGatedAction(() => setRouteOpen(true));
                      }}
                      className="self-start mt-1 inline-flex items-center gap-1.5 bg-foreground text-background rounded-full px-3 py-1.5 text-xs font-medium hover:bg-foreground/90 transition-colors cursor-pointer"
                    >
                      <Navigation className="size-3.5" /> Route me there
                    </span>
                  </div>
                </div>
              </button>
            </>
          ) : (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-4 text-sm text-muted-foreground text-center">
              No spots in this category yet for {destination.city}.
            </div>
          )}
        </div>
      </div>

      {/* Spot details modal */}
      <SpotModal
        spot={openSpot}
        isNextStop={openSpot?.id === nextStopId}
        onClose={() => setOpenSpotId(null)}
        onSetNextStop={(s) => runGatedAction(() => { setNextStopId(s.id); setOpenSpotId(null); })}
        onRoute={(s) => runGatedAction(() => { setNextStopId(s.id); setRouteOpen(true); setOpenSpotId(null); })}
      />
      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSubmitted={() => setAuthOpen(false)}
      />
      <OnboardingDialog open={onboardingOpen} onComplete={handleOnboardingComplete} />
    </main>
  );
};

export default ExplorePage;
