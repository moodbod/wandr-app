"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Search, Coffee, Eye, Sparkles, Route as RouteIcon, Clock, ArrowUpRight, Navigation, ListChecks } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AuthDialog } from "@/components/AuthDialog";
import { AuthStatus } from "@/components/AuthStatus";
import DestinationPicker from "@/components/DestinationPicker";
import MapboxStreetsMap, { type RouteSummary } from "@/components/MapboxStreetsMap";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import RoutePanel from "@/components/RoutePanel";
import SpotModal from "@/components/SpotModal";
import TripPanel from "@/components/TripPanel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { destinations, type Spot } from "@/data/destinations";
import { getCurrentStop, getRouteStopIds, getTripProgress, hasTripSpot, orderedTripStops } from "@/lib/tripPlanner";

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
  const [fallbackNextStopId, setFallbackNextStopId] = useState<string | null>(destination.spots[0]?.id ?? null);
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);
  const [fallbackRouteMode, setFallbackRouteMode] = useState<"walk" | "drive">("walk");
  const [routeOpen, setRouteOpen] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const pendingActionRef = useRef<GatedAction | null>(null);
  const tripData = useQuery(
    api.trips.getActiveForDestination,
    isAuthenticated && currentUser?.onboardingCompleted ? { destinationId: destination.id } : "skip"
  );
  const addTripStop = useMutation(api.trips.addStop);
  const removeTripStop = useMutation(api.trips.removeStop);
  const moveTripStop = useMutation(api.trips.moveStop);
  const setNextTripStop = useMutation(api.trips.setNextStop);
  const startTrip = useMutation(api.trips.startTrip);
  const markTripStopDone = useMutation(api.trips.markStopDone);
  const skipTripStop = useMutation(api.trips.skipStop);
  const setTripRouteMode = useMutation(api.trips.setRouteMode);

  const visibleSpots = useMemo(
    () => destination.spots.filter((s) => activeCat === "all" || activeCat === "routes" || s.category === activeCat),
    [destination, activeCat]
  );

  const tripStops = useMemo(() => orderedTripStops(tripData?.stops ?? []), [tripData?.stops]);
  const tripPanelData = isAuthenticated && currentUser?.onboardingCompleted ? tripData : null;
  const currentTripStop = tripData?.trip ? getCurrentStop(tripStops, tripData.trip.status) : null;
  const fallbackNextStop = destination.spots.find((s) => s.id === fallbackNextStopId) ?? destination.spots[0];
  const nextStop: Spot | undefined =
    (currentTripStop ? destination.spots.find((s) => s.id === currentTripStop.spotId) : null) ?? fallbackNextStop;
  const routedSpotId = routeOpen ? nextStop?.id ?? null : null;
  const openSpot: Spot | null =
    destination.spots.find((s) => s.id === openSpotId) ?? null;
  const routeMode = tripData?.trip.routeMode ?? fallbackRouteMode;
  const tripProgress = getTripProgress(tripStops);
  const showDesktopTripPanel = tripProgress.total > 0;
  const isActiveTrip = tripData?.trip.status === "active";
  const isPlanningTrip = tripData?.trip.status === "planning" && tripProgress.total > 0;
  const stopPillLabel = isActiveTrip ? "Next" : isPlanningTrip ? "First stop" : "Suggested";
  const stopCardLabel = isActiveTrip ? nextStop?.tag : isPlanningTrip ? "Ready to start" : nextStop?.tag;
  const stopActionLabel = isActiveTrip ? "Route me there" : isPlanningTrip ? "Start trip" : "Route me there";
  const routeStopsForMap = useMemo(() => {
    const stopIds = getRouteStopIds(tripStops, tripData?.trip.status);
    return stopIds
      .map((spotId) => destination.spots.find((spot) => spot.id === spotId))
      .filter((spot): spot is Spot => Boolean(spot));
  }, [destination.spots, tripData?.trip.status, tripStops]);

  const handleDestinationChange = (d: typeof destinations[number]) => {
    setDestination(d);
    setFallbackNextStopId(d.spots[0]?.id ?? null);
    setOpenSpotId(null);
    setRouteOpen(false);
    setRouteSummary(null);
    setTripSheetOpen(false);
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

  const handleAddSpotToTrip = useCallback(
    (spot: Spot) => {
      runGatedAction(() => {
        void addTripStop({ destinationId: destination.id, spotId: spot.id });
        setFallbackNextStopId(spot.id);
      });
    },
    [addTripStop, destination.id, runGatedAction]
  );

  const handleRouteSpot = useCallback(
    (spot: Spot) => {
      runGatedAction(() => {
        setFallbackNextStopId(spot.id);
        setRouteOpen(true);
        setOpenSpotId(null);
      });
    },
    [runGatedAction]
  );

  const handleSetNextStop = useCallback(
    (spot: Spot) => {
      runGatedAction(() => {
        void setNextTripStop({ destinationId: destination.id, spotId: spot.id });
        setFallbackNextStopId(spot.id);
        setOpenSpotId(null);
      });
    },
    [destination.id, runGatedAction, setNextTripStop]
  );

  const handleStartRoute = useCallback(
    (spot: Spot) => {
      runGatedAction(() => {
        if (tripData?.trip.status === "planning") {
          void startTrip({ tripId: tripData.trip._id });
          setRouteOpen(true);
          return;
        }

        if (tripData?.trip.status === "active") {
          setRouteOpen(true);
          return;
        }

        void setNextTripStop({ destinationId: destination.id, spotId: spot.id }).then(({ tripId }) => {
          void startTrip({ tripId });
          setRouteOpen(true);
        });
      });
    },
    [destination.id, runGatedAction, setNextTripStop, startTrip, tripData?.trip]
  );

  const handleSetRouteMode = useCallback(
    (mode: "walk" | "drive") => {
      runGatedAction(() => {
        setRouteSummary(null);
        if (tripData?.trip) {
          void setTripRouteMode({ tripId: tripData.trip._id, routeMode: mode });
          return;
        }

        setFallbackRouteMode(mode);
      });
    },
    [runGatedAction, setTripRouteMode, tripData?.trip]
  );

  const handleRouteSummaryChange = useCallback((summary: RouteSummary | null) => {
    setRouteSummary(summary);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Map */}
      <div className={["absolute inset-0", showDesktopTripPanel ? "lg:left-96" : ""].join(" ")}>
        <MapboxStreetsMap
          destination={destination}
          spots={visibleSpots}
          nextStop={nextStop}
          routeStops={routeStopsForMap}
          routeOpen={routeOpen}
          routeMode={routeMode}
          onOpenSpot={handleOpenSpot}
          onRouteSummaryChange={handleRouteSummaryChange}
        />
        <div className="absolute inset-0 pointer-events-none bg-background/30" />
      </div>

      {/* Top */}
      <header
        className={[
          "absolute top-0 left-0 right-0 z-30 px-4 pt-5 sm:px-6 sm:pt-6",
          showDesktopTripPanel ? "lg:left-96" : "",
        ].join(" ")}
      >
        <div
          className={[
            "flex flex-col gap-3",
            showDesktopTripPanel
              ? "lg:grid lg:grid-cols-[12rem_minmax(20rem,42rem)_max-content] lg:items-start lg:gap-x-6"
              : "lg:grid lg:grid-cols-[12rem_minmax(20rem,42rem)_max-content] lg:items-start lg:gap-x-6 lg:justify-between",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3 lg:contents">
            <h1 className="text-xl font-semibold tracking-tight lg:col-start-1 lg:pt-3">
              Wandr
            </h1>
            <div className="flex items-center gap-2 lg:col-start-3">
              <DestinationPicker value={destination} onChange={handleDestinationChange} />
              <AuthStatus
                userName={currentUser?.name}
                userEmail={currentUser?.email}
                onSignIn={() => setAuthOpen(true)}
              />
            </div>
          </div>

          <div
            className={[
              "mx-auto flex w-full max-w-2xl flex-col gap-3 lg:row-start-1 lg:pt-0",
              showDesktopTripPanel ? "lg:col-start-2 lg:mx-0 lg:max-w-none" : "lg:col-start-2 lg:mx-auto",
            ].join(" ")}
          >
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
      <div
        className={[
          "absolute bottom-0 left-0 right-0 z-30 px-4 pb-5 sm:px-6 sm:pb-6",
          showDesktopTripPanel ? "lg:left-96" : "",
        ].join(" ")}
      >
        <div className="mx-auto max-w-2xl flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => runGatedAction(() => setTripSheetOpen(true))}
            className="self-end inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-secondary lg:hidden"
          >
            <ListChecks className="size-3.5" />
            Trip
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {tripProgress.total}
            </span>
          </button>

          {nextStop && routeOpen ? (
            <RoutePanel
              spot={nextStop}
              mode={routeMode}
              summary={routeSummary}
              isActive={tripData?.trip.status === "active"}
              onModeChange={handleSetRouteMode}
              onClose={() => setRouteOpen(false)}
              onStart={() => handleStartRoute(nextStop)}
            />
          ) : nextStop ? (
            <>
              <div className="self-end bg-card border border-border rounded-full pl-2 pr-3 py-1.5 shadow-sm flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full bg-highlight" />
                <span className="font-medium">{stopPillLabel}: {nextStop.name}</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3" /> {routeMode === "drive" ? nextStop.driveMin : nextStop.walkMin} min
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
                          {stopCardLabel}
                        </div>
                        <h2 className="text-lg font-semibold leading-tight mt-0.5">{nextStop.name}</h2>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-sm font-semibold tabular-nums">
                          {routeMode === "drive" ? nextStop.driveMin : nextStop.walkMin} min
                        </span>
                        <span className="text-[11px] text-muted-foreground">{routeMode}</span>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">{nextStop.tip}</p>

                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPlanningTrip) {
                          handleStartRoute(nextStop);
                          return;
                        }

                        runGatedAction(() => setRouteOpen(true));
                      }}
                      className="self-start mt-1 inline-flex items-center gap-1.5 bg-foreground text-background rounded-full px-3 py-1.5 text-xs font-medium hover:bg-foreground/90 transition-colors cursor-pointer"
                    >
                      <Navigation className="size-3.5" /> {stopActionLabel}
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

      {showDesktopTripPanel ? (
        <div className="absolute bottom-0 left-0 top-0 z-30 hidden w-96 animate-in slide-in-from-left-6 duration-300 border-r border-border shadow-xl lg:block">
          <TripPanel
            destination={destination}
            tripData={tripPanelData}
            selectedSpot={openSpot}
            routedSpotId={routedSpotId}
            onAddSpot={handleAddSpotToTrip}
            onRemoveStop={(tripStopId) => runGatedAction(() => void removeTripStop({ tripStopId: tripStopId as Id<"tripStops"> }))}
            onMoveStop={(tripStopId, direction) => runGatedAction(() => void moveTripStop({ tripStopId: tripStopId as Id<"tripStops">, direction }))}
            onStartTrip={(tripId) => runGatedAction(() => void startTrip({ tripId: tripId as Id<"trips"> }))}
            onRouteStop={handleRouteSpot}
            onMarkDone={(tripStopId) => runGatedAction(() => void markTripStopDone({ tripStopId: tripStopId as Id<"tripStops"> }))}
            onSkipStop={(tripStopId) => runGatedAction(() => void skipTripStop({ tripStopId: tripStopId as Id<"tripStops"> }))}
            onRouteModeChange={(tripId, mode) => runGatedAction(() => void setTripRouteMode({ tripId: tripId as Id<"trips">, routeMode: mode }))}
          />
        </div>
      ) : null}

      <Sheet open={tripSheetOpen} onOpenChange={setTripSheetOpen}>
        <SheetContent side="bottom" className="h-[82dvh] p-0 lg:hidden">
          <SheetTitle className="sr-only">Your adventure</SheetTitle>
          <TripPanel
            destination={destination}
            tripData={tripPanelData}
            selectedSpot={openSpot}
            routedSpotId={routedSpotId}
            onAddSpot={handleAddSpotToTrip}
            onRemoveStop={(tripStopId) => runGatedAction(() => void removeTripStop({ tripStopId: tripStopId as Id<"tripStops"> }))}
            onMoveStop={(tripStopId, direction) => runGatedAction(() => void moveTripStop({ tripStopId: tripStopId as Id<"tripStops">, direction }))}
            onStartTrip={(tripId) => runGatedAction(() => {
              void startTrip({ tripId: tripId as Id<"trips"> });
              setTripSheetOpen(false);
            })}
            onRouteStop={(spot) => {
              handleRouteSpot(spot);
              setTripSheetOpen(false);
            }}
            onMarkDone={(tripStopId) => runGatedAction(() => void markTripStopDone({ tripStopId: tripStopId as Id<"tripStops"> }))}
            onSkipStop={(tripStopId) => runGatedAction(() => void skipTripStop({ tripStopId: tripStopId as Id<"tripStops"> }))}
            onRouteModeChange={(tripId, mode) => runGatedAction(() => void setTripRouteMode({ tripId: tripId as Id<"trips">, routeMode: mode }))}
          />
        </SheetContent>
      </Sheet>

      {/* Spot details modal */}
      <SpotModal
        spot={openSpot}
        isNextStop={openSpot?.id === nextStop?.id}
        isInTrip={openSpot ? hasTripSpot(tripStops, openSpot.id) : false}
        onClose={() => setOpenSpotId(null)}
        onSetNextStop={handleSetNextStop}
        onRoute={handleRouteSpot}
        onAddToTrip={(s) => {
          handleAddSpotToTrip(s);
          setOpenSpotId(null);
        }}
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
