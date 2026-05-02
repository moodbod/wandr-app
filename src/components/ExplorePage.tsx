"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Search, Coffee, Eye, Gem, Map, Route as RouteIcon, Navigation, SlidersHorizontal, ChevronDown, ListChecks } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AuthDialog } from "@/components/AuthDialog";
import { AuthStatus } from "@/components/AuthStatus";
import MapboxStreetsMap, { type RouteSummary } from "@/components/MapboxStreetsMap";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import RoutePanel from "@/components/RoutePanel";
import SpotModal from "@/components/SpotModal";
import TripPanel from "@/components/TripPanel";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import type { Destination, Spot } from "@/data/destinations";
import {
  applyOfflineAction,
  createOfflineAction,
  readActiveTripSnapshot,
  readOfflineTripQueue,
  saveActiveTripSnapshot,
  saveOfflineTripQueue,
  type ActiveTripSnapshot,
  type OfflineTripAction,
  type PersistedTripData,
} from "@/lib/activeTripPersistence";
import { getCurrentStop, getRouteStopIds, getTripProgress, hasTripSpot, orderedTripStops } from "@/lib/tripPlanner";

const categories = [
  { id: "all", label: "All", mobileLabel: "All", icon: Map },
  { id: "eat", label: "Eat", mobileLabel: "Eat", icon: Coffee },
  { id: "see", label: "See", mobileLabel: "See", icon: Eye },
  { id: "gems", label: "Hidden gems", mobileLabel: "Gems", icon: Gem },
  { id: "routes", label: "Routes", mobileLabel: "Routes", icon: RouteIcon },
] as const;

type GatedAction = () => void;

type ExplorePageProps = {
  initialDestinationId?: string;
};

type ExploreSpot = Spot & {
  destinationId: string;
  destinationCity: string;
  destinationCountry: string;
};

const namibiaMap = {
  center: [17.0832, -22.5597] as [number, number],
  zoom: 5.2,
  label: "Namibia",
};

function isTripData(value: unknown): value is PersistedTripData {
  return Boolean(
    value &&
      typeof value === "object" &&
      "trip" in value &&
      "stops" in value &&
      (value as PersistedTripData).trip &&
      Array.isArray((value as PersistedTripData).stops),
  );
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

function snapshotIdentity(snapshot: ActiveTripSnapshot | null) {
  if (!snapshot) {
    return "";
  }

  return JSON.stringify({
    destinationId: snapshot.destinationId,
    routeOpen: snapshot.routeOpen,
    routedSpotId: snapshot.routedSpotId,
    trip: snapshot.trip,
    stops: snapshot.stops,
  });
}

const ExplorePage = ({ initialDestinationId: _initialDestinationId }: ExplorePageProps) => {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const catalogData = useQuery(api.content.listPublic, {});
  const destinations = useMemo(() => (isDestinationList(catalogData) ? catalogData : []), [catalogData]);
  const allSpots = useMemo<ExploreSpot[]>(
    () =>
      destinations.flatMap((destination) =>
        destination.spots.map((spot) => ({
          ...spot,
          destinationId: destination.id,
          destinationCity: destination.city,
          destinationCountry: destination.country,
        })),
      ),
    [destinations],
  );
  const currentUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const [localSnapshot, setLocalSnapshot] = useState<ActiveTripSnapshot | null>(() => readActiveTripSnapshot());
  const [optimisticTripData, setOptimisticTripData] = useState<PersistedTripData | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineTripAction[]>(() => readOfflineTripQueue());
  const [activeCat, setActiveCat] = useState<(typeof categories)[number]["id"]>("all");
  const [fallbackNextStopId, setFallbackNextStopId] = useState<string | null>(localSnapshot?.routedSpotId ?? null);
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);
  const [fallbackRouteMode, setFallbackRouteMode] = useState<"walk" | "drive">("walk");
  const [routeOpen, setRouteOpen] = useState(() => Boolean(localSnapshot?.routeOpen));
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const pendingActionRef = useRef<GatedAction | null>(null);
  const tripData = useQuery(
    api.trips.getActiveForExplore,
    isAuthenticated && currentUser?.onboardingCompleted ? {} : "skip"
  );
  const addTripStop = useMutation(api.trips.addStop);
  const removeTripStop = useMutation(api.trips.removeStop);
  const setNextTripStop = useMutation(api.trips.setNextStop);
  const startTrip = useMutation(api.trips.startTrip);
  const syncOfflineAction = useMutation(api.trips.syncOfflineAction);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const syncingRef = useRef(false);

  const visibleSpots = useMemo(
    () => allSpots.filter((s) => activeCat === "all" || activeCat === "routes" || s.category === activeCat),
    [allSpots, activeCat]
  );

  const resumeTripData = useQuery(
    api.trips.resumeActive,
    isAuthenticated && currentUser?.onboardingCompleted
      ? { preferredTripId: localSnapshot?.trip.status === "active" ? localSnapshot.trip._id as Id<"trips"> : undefined }
      : "skip"
  );
  const effectiveTripData =
    optimisticTripData ??
    (isTripData(resumeTripData) ? resumeTripData : null) ??
    (isTripData(tripData) ? tripData : null) ??
    localSnapshot;
  const tripStops = useMemo(() => orderedTripStops(effectiveTripData?.stops ?? []), [effectiveTripData?.stops]);
  const canUseLocalOfflineTrip = !isOnline && localSnapshot?.trip.status === "active";
  const tripPanelData = (isAuthenticated && currentUser?.onboardingCompleted) || canUseLocalOfflineTrip ? effectiveTripData : null;
  const currentTripStop = effectiveTripData?.trip ? getCurrentStop(tripStops, effectiveTripData.trip.status) : null;
  const fallbackNextStop = allSpots.find((s) => s.id === fallbackNextStopId) ?? allSpots[0];
  const routedFallbackStop = routeOpen ? fallbackNextStop : null;
  const nextStop: ExploreSpot | undefined =
    routedFallbackStop ?? (currentTripStop ? allSpots.find((s) => s.id === currentTripStop.spotId) : null) ?? fallbackNextStop;
  const routedSpotId = routeOpen ? nextStop?.id ?? null : null;
  const openSpot: ExploreSpot | null =
    allSpots.find((s) => s.id === openSpotId) ?? null;
  const routeMode = effectiveTripData?.trip.routeMode ?? fallbackRouteMode;
  const activeCategory = categories.find((category) => category.id === activeCat) ?? categories[0];
  const tripProgress = getTripProgress(tripStops);
  const showDesktopTripPanel = tripProgress.total > 0;
  const isActiveTrip = effectiveTripData?.trip.status === "active";
  const isPlanningTrip = effectiveTripData?.trip.status === "planning" && tripProgress.total > 0;
  const isInactiveRecommendation = !isActiveTrip && !isPlanningTrip;
  const stopPillLabel = isActiveTrip ? "Next" : isPlanningTrip ? "First stop" : "Suggested";
  const stopCardLabel = isActiveTrip ? nextStop?.tag : isPlanningTrip ? "Ready to start" : nextStop?.tag;
  const stopActionLabel = isActiveTrip ? "Route me there" : isPlanningTrip ? "Start trip" : "Route me there";
  const highlightedSpotId = nextStop && (routeOpen || isActiveTrip || isPlanningTrip) ? nextStop.id : null;
  const routeStopsForMap = useMemo(() => {
    const stopIds = getRouteStopIds(tripStops, effectiveTripData?.trip.status);
    return stopIds
      .map((spotId) => allSpots.find((spot) => spot.id === spotId))
      .filter((spot): spot is NonNullable<typeof spot> => Boolean(spot));
  }, [allSpots, effectiveTripData?.trip.status, tripStops]);

  useEffect(() => {
    if (fallbackNextStopId || allSpots.length === 0) {
      return;
    }

    setFallbackNextStopId(allSpots[0].id);
  }, [allSpots, fallbackNextStopId]);

  useEffect(() => {
    if (!isActiveTrip || !currentTripStop || currentTripStop.spotId === fallbackNextStopId) {
      return;
    }

    setFallbackNextStopId(currentTripStop.spotId);
  }, [currentTripStop, fallbackNextStopId, isActiveTrip]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    saveOfflineTripQueue(offlineQueue);
  }, [offlineQueue]);

  useEffect(() => {
    if (!resumeTripData?.trip) {
      return;
    }

    const resumedSpotId = getCurrentStop(resumeTripData.stops, resumeTripData.trip.status)?.spotId;

    if (!resumedSpotId || resumedSpotId === fallbackNextStopId) {
      return;
    }

    setFallbackNextStopId(resumedSpotId);
    setOpenSpotId(null);
    setRouteOpen(true);
    setRouteSummary(null);
    setTripSheetOpen(false);
  }, [fallbackNextStopId, resumeTripData]);

  useEffect(() => {
    if (!effectiveTripData?.trip || effectiveTripData.trip.status !== "active") {
      return;
    }

    const snapshot: ActiveTripSnapshot = {
      trip: effectiveTripData.trip,
      stops: effectiveTripData.stops,
      destinationId: effectiveTripData.trip.destinationId ?? "namibia",
      routeOpen,
      routedSpotId,
      lastViewedAt: Date.now(),
    };

    setLocalSnapshot((current) => {
      if (snapshotIdentity(current) === snapshotIdentity(snapshot)) {
        return current;
      }

      saveActiveTripSnapshot(snapshot);
      return snapshot;
    });
  }, [effectiveTripData, routeOpen, routedSpotId]);

  useEffect(() => {
    if (!isOnline || offlineQueue.length > 0 || (!resumeTripData && !tripData)) {
      return;
    }

    setOptimisticTripData(null);
  }, [isOnline, offlineQueue.length, resumeTripData, tripData]);

  const runGatedAction = useCallback(
    (action: GatedAction) => {
      if (!isOnline && localSnapshot?.trip.status === "active") {
        action();
        return;
      }

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
    [authLoading, currentUser, isAuthenticated, isOnline, localSnapshot?.trip.status]
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

  const buildCurrentSnapshot = useCallback((): ActiveTripSnapshot | null => {
    if (!effectiveTripData?.trip) {
      return null;
    }

    return {
      trip: effectiveTripData.trip,
      stops: effectiveTripData.stops,
      destinationId: effectiveTripData.trip.destinationId ?? "namibia",
      routeOpen,
      routedSpotId,
      lastViewedAt: Date.now(),
    };
  }, [effectiveTripData, routeOpen, routedSpotId]);

  const persistSnapshot = useCallback((snapshot: ActiveTripSnapshot) => {
    setLocalSnapshot(snapshot);
    setOptimisticTripData({ trip: snapshot.trip, stops: snapshot.stops });
    saveActiveTripSnapshot(snapshot);
  }, []);

  const queueOfflineAction = useCallback(
    (action: OfflineTripAction) => {
      const snapshot = buildCurrentSnapshot();

      if (!snapshot) {
        return;
      }

      persistSnapshot(applyOfflineAction(snapshot, action));
      setOfflineQueue((current) => [...current, action]);
    },
    [buildCurrentSnapshot, persistSnapshot],
  );

  const runOfflineCapableTripAction = useCallback(
    (action: OfflineTripAction) => {
      const syncAction =
        action.type === "markDone"
          ? { type: "markDone" as const, tripStopId: action.tripStopId as Id<"tripStops"> }
          : action.type === "skip"
            ? { type: "skip" as const, tripStopId: action.tripStopId as Id<"tripStops"> }
            : action.type === "moveStop"
              ? {
                  type: "moveStop" as const,
                  tripStopId: action.tripStopId as Id<"tripStops">,
                  direction: action.direction,
                }
              : { type: "setRouteMode" as const, routeMode: action.routeMode };

      if (!isOnline) {
        queueOfflineAction(action);
        return;
      }

      void syncOfflineAction({ tripId: action.tripId as Id<"trips">, action: syncAction })
        .then((payload) => {
          const snapshot: ActiveTripSnapshot = {
            trip: payload.trip,
            stops: payload.stops,
            destinationId: payload.trip.destinationId,
            routeOpen,
            routedSpotId,
            lastViewedAt: Date.now(),
          };
          persistSnapshot(snapshot);
        })
        .catch(() => queueOfflineAction(action));
    },
    [isOnline, persistSnapshot, queueOfflineAction, routeOpen, routedSpotId, syncOfflineAction],
  );

  useEffect(() => {
    if (!isOnline || !isAuthenticated || !currentUser?.onboardingCompleted || offlineQueue.length === 0 || syncingRef.current) {
      return;
    }

    syncingRef.current = true;

    const syncQueuedActions = async () => {
      const remaining = [...offlineQueue];

      while (remaining.length > 0) {
        const action = remaining[0];
        const syncAction =
          action.type === "markDone"
            ? { type: "markDone" as const, tripStopId: action.tripStopId as Id<"tripStops"> }
            : action.type === "skip"
              ? { type: "skip" as const, tripStopId: action.tripStopId as Id<"tripStops"> }
              : action.type === "moveStop"
                ? {
                    type: "moveStop" as const,
                    tripStopId: action.tripStopId as Id<"tripStops">,
                    direction: action.direction,
                  }
                : { type: "setRouteMode" as const, routeMode: action.routeMode };

        try {
          const payload = await syncOfflineAction({ tripId: action.tripId as Id<"trips">, action: syncAction });
          const snapshot: ActiveTripSnapshot = {
            trip: payload.trip,
            stops: payload.stops,
            destinationId: payload.trip.destinationId,
            routeOpen,
            routedSpotId,
            lastViewedAt: Date.now(),
          };
          persistSnapshot(snapshot);
          remaining.shift();
          setOfflineQueue([...remaining]);

          if (payload.reason === "completed") {
            remaining.length = 0;
            setOfflineQueue([]);
            break;
          }
        } catch {
          break;
        }
      }

      syncingRef.current = false;
    };

    void syncQueuedActions();
  }, [
    currentUser?.onboardingCompleted,
    isAuthenticated,
    isOnline,
    offlineQueue,
    persistSnapshot,
    routeOpen,
    routedSpotId,
    syncOfflineAction,
  ]);

  const handleAddSpotToTrip = useCallback(
    (spot: ExploreSpot) => {
      runGatedAction(() => {
        void addTripStop({ destinationId: spot.destinationId, spotId: spot.id });
        setFallbackNextStopId(spot.id);
      });
    },
    [addTripStop, runGatedAction]
  );

  const handleRouteSpot = useCallback(
    (spot: ExploreSpot) => {
      runGatedAction(() => {
        setFallbackNextStopId(spot.id);
        setRouteOpen(true);
        setOpenSpotId(null);
      });
    },
    [runGatedAction]
  );

  const handleSetNextStop = useCallback(
    (spot: ExploreSpot) => {
      runGatedAction(() => {
        void setNextTripStop({ destinationId: spot.destinationId, spotId: spot.id });
        setFallbackNextStopId(spot.id);
        setOpenSpotId(null);
      });
    },
    [runGatedAction, setNextTripStop]
  );

  const handleStartRoute = useCallback(
    (spot: ExploreSpot) => {
      runGatedAction(() => {
        if (effectiveTripData?.trip.status === "planning") {
          void startTrip({ tripId: effectiveTripData.trip._id as Id<"trips"> }).then((payload) => {
            persistSnapshot({
              trip: payload.trip,
              stops: payload.stops,
              destinationId: payload.trip.destinationId,
              routeOpen: true,
              routedSpotId: getCurrentStop(payload.stops, payload.trip.status)?.spotId ?? null,
              lastViewedAt: Date.now(),
            });
          });
          setRouteOpen(true);
          return;
        }

        if (effectiveTripData?.trip.status === "active") {
          setRouteOpen(true);
          return;
        }

        void setNextTripStop({ destinationId: spot.destinationId, spotId: spot.id }).then(({ tripId }) => {
          void startTrip({ tripId }).then((payload) => {
            persistSnapshot({
              trip: payload.trip,
              stops: payload.stops,
              destinationId: payload.trip.destinationId,
              routeOpen: true,
              routedSpotId: getCurrentStop(payload.stops, payload.trip.status)?.spotId ?? null,
              lastViewedAt: Date.now(),
            });
          });
          setRouteOpen(true);
        });
      });
    },
    [effectiveTripData?.trip, persistSnapshot, runGatedAction, setNextTripStop, startTrip]
  );

  const handleSetRouteMode = useCallback(
    (mode: "walk" | "drive") => {
      runGatedAction(() => {
        setRouteSummary(null);
        if (effectiveTripData?.trip) {
          runOfflineCapableTripAction(
            createOfflineAction({
              tripId: effectiveTripData.trip._id,
              type: "setRouteMode",
              routeMode: mode,
            }),
          );
          return;
        }

        setFallbackRouteMode(mode);
      });
    },
    [effectiveTripData?.trip, runGatedAction, runOfflineCapableTripAction]
  );

  const handleRouteSummaryChange = useCallback((summary: RouteSummary | null) => {
    setRouteSummary(summary);
  }, []);

  if (catalogData === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          Loading places...
        </div>
      </main>
    );
  }

  if (allSpots.length === 0) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <div className="max-w-sm rounded-lg border border-border bg-card p-5 text-center shadow-sm">
          <h1 className="text-lg font-semibold">No places yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask an admin to seed or add the first Wandr destination in Convex.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-x-0 bottom-[calc(0px_-_env(safe-area-inset-bottom))] top-[calc(0px_-_env(safe-area-inset-top))] overflow-hidden bg-background text-foreground">
      {/* Map */}
      <div className={["absolute inset-0", showDesktopTripPanel ? "lg:left-96" : ""].join(" ")}>
        <MapboxStreetsMap
          mapConfig={namibiaMap}
          spots={visibleSpots}
          nextStop={nextStop}
          highlightedSpotId={highlightedSpotId}
          routeStops={routeStopsForMap}
          routeOpen={routeOpen}
          routeMode={routeMode}
          onOpenSpot={handleOpenSpot}
          onRouteSummaryChange={handleRouteSummaryChange}
        />
      </div>

      {/* Top */}
      <header
        className={[
          "absolute left-0 right-0 top-[env(safe-area-inset-top)] z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6",
          showDesktopTripPanel ? "lg:left-96" : "",
        ].join(" ")}
      >
        <div className="sm:hidden">
          <div className="relative w-full">
            <div className="relative z-40 flex w-full items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => runGatedAction(() => undefined)}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-white/70 bg-white/95 text-foreground backdrop-blur-xl transition-transform active:scale-95"
                aria-label="Search Namibia"
              >
                <Search className="size-4" />
              </button>

              <div className="flex min-w-0 items-center justify-end gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMobileFilterOpen((open) => !open)}
                    className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-3.5 text-xs font-medium text-foreground backdrop-blur-xl transition-transform active:scale-95"
                    aria-expanded={mobileFilterOpen}
                    aria-label="Filter places"
                  >
                    <SlidersHorizontal className="size-3.5 shrink-0" />
                    <span>{activeCategory.mobileLabel}</span>
                    <ChevronDown className={`size-3.5 shrink-0 transition-transform ${mobileFilterOpen ? "rotate-180" : ""}`} />
                  </button>

                  {mobileFilterOpen ? (
                    <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-1 backdrop-blur-xl">
                      {categories.map((category) => {
                        const isActive = activeCat === category.id;
                        const Icon = category.icon;
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              setActiveCat(category.id);
                              setMobileFilterOpen(false);
                            }}
                            className={[
                              "flex h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition-colors",
                              isActive ? "bg-foreground text-background" : "text-foreground hover:bg-secondary",
                            ].join(" ")}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span>{category.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <AuthStatus
                  userName={currentUser?.name}
                  userEmail={currentUser?.email}
                  onSignIn={() => setAuthOpen(true)}
                />
              </div>
            </div>

            {mobileFilterOpen ? (
              <div className="fixed inset-0 z-30" onClick={() => setMobileFilterOpen(false)} />
            ) : null}
          </div>
        </div>

        <div
          className={[
            "hidden flex-col gap-2.5 sm:flex sm:gap-3",
            showDesktopTripPanel
              ? "lg:grid lg:grid-cols-[12rem_minmax(20rem,42rem)_max-content] lg:items-start lg:gap-x-6"
              : "lg:grid lg:grid-cols-[12rem_minmax(20rem,42rem)_max-content] lg:items-start lg:gap-x-6 lg:justify-between",
          ].join(" ")}
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 lg:contents">
            <h1 className="rounded-full bg-card/95 px-3.5 py-2.5 text-base font-semibold tracking-tight shadow-sm backdrop-blur-md lg:col-start-1 lg:bg-transparent lg:px-0 lg:pt-3 lg:text-xl lg:shadow-none lg:backdrop-blur-0">
              Wandr
            </h1>
            <div className="contents lg:col-start-3 lg:flex lg:items-center lg:gap-2">
              <AuthStatus
                userName={currentUser?.name}
                userEmail={currentUser?.email}
                onSignIn={() => setAuthOpen(true)}
              />
            </div>
          </div>

          <div
            className={[
              "mx-auto flex w-full max-w-2xl flex-col gap-2.5 lg:row-start-1 lg:gap-3 lg:pt-0",
              showDesktopTripPanel ? "lg:col-start-2 lg:mx-0 lg:max-w-none" : "lg:col-start-2 lg:mx-auto",
            ].join(" ")}
          >
            <form
              className="flex items-center gap-2 rounded-full border border-border bg-card/95 py-1.5 pl-4 pr-1.5 shadow-lg shadow-foreground/10 backdrop-blur-md lg:bg-card lg:shadow-sm lg:backdrop-blur-0"
              onSubmit={(event) => {
                event.preventDefault();
                runGatedAction(() => undefined);
              }}
            >
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="I'm in Namibia. What should I see?"
                className="min-w-0 w-full bg-transparent py-1.5 text-[16px] placeholder:text-muted-foreground focus:outline-none sm:text-sm"
              />
              <button
                type="submit"
                className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
              >
                Ask
              </button>
            </form>

            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
              {categories.map((c) => {
                const isActive = activeCat === c.id;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={[
                      "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium shadow-sm transition-colors",
                      isActive ? "bg-foreground text-background" : "border border-border bg-card/95 text-foreground backdrop-blur-md hover:bg-secondary",
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
          "absolute bottom-0 left-0 right-0 z-30 sm:px-6 sm:pb-6",
          showDesktopTripPanel ? "lg:left-96" : "",
        ].join(" ")}
      >
        <div className="mx-auto flex w-[calc(100%-1rem)] max-w-[24.5rem] flex-col sm:w-full sm:max-w-2xl sm:gap-2.5">
          {nextStop && routeOpen ? (
            <div className="rounded-t-[2rem] bg-card px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 shadow-2xl shadow-foreground/20 sm:rounded-none sm:bg-transparent sm:p-0 sm:shadow-none">
              <div className="mx-auto mb-3 h-1 w-7 rounded-full bg-muted sm:hidden" />
              <RoutePanel
                spot={nextStop}
                mode={routeMode}
                summary={routeSummary}
                isActive={effectiveTripData?.trip.status === "active"}
                onModeChange={handleSetRouteMode}
                onClose={() => setRouteOpen(false)}
                onStart={() => handleStartRoute(nextStop)}
              />
            </div>
          ) : nextStop ? (
            <div className="rounded-t-[2rem] bg-card px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 shadow-2xl shadow-foreground/20 sm:rounded-none sm:bg-transparent sm:p-0 sm:shadow-none">
              <div className="mx-auto mb-3 h-1 w-7 rounded-full bg-muted sm:hidden" />
              <div className="mb-4 flex items-center justify-between gap-3 sm:hidden">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                    <ListChecks className="size-3.5" />
                    {isActiveTrip ? "Active trip" : isPlanningTrip ? "Trip ready" : "Start a trip"}
                  </div>
                  <div className="mt-0.5 truncate text-lg font-black leading-none tracking-[-0.04em] text-foreground">
                    {tripProgress.total > 0 ? `${tripProgress.total} stop${tripProgress.total === 1 ? "" : "s"}` : "Suggested stop"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => runGatedAction(() => setTripSheetOpen(true))}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-xs font-semibold text-background transition-transform active:scale-95"
                  aria-label={`Open trip with ${tripProgress.total} stops`}
                >
                  Trip
                </button>
              </div>

              <div
                className="group overflow-hidden rounded-[1.45rem] bg-foreground text-left text-background shadow-xl shadow-foreground/15 transition-transform active:scale-[0.99] sm:rounded-[1.35rem] sm:border sm:border-border sm:bg-card sm:text-foreground sm:shadow-2xl sm:shadow-foreground/15 sm:hover:border-foreground/20"
              >
                <div className="relative min-h-[7.6rem] sm:grid sm:min-h-[10.5rem] sm:grid-cols-[8rem_1fr]">
                  <img src={nextStop.image} alt={nextStop.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:static sm:min-h-[10.5rem]" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent sm:hidden" />
                  <div className="relative flex min-h-[7.6rem] min-w-0 flex-col justify-end gap-1.5 p-4 sm:min-h-0 sm:justify-start sm:gap-2 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/85 sm:text-[11px] sm:font-medium sm:tracking-wider sm:text-accent">
                          {isInactiveRecommendation ? "You might like this" : stopCardLabel}
                        </div>
                        <h2 className="mt-0.5 line-clamp-2 text-base font-semibold leading-tight text-white sm:text-lg sm:text-foreground">{nextStop.name}</h2>
                        {isInactiveRecommendation ? (
                          <div className="mt-1 hidden text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:block">
                            {nextStop.tag}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-white/95 px-3 text-foreground shadow-sm sm:h-auto sm:flex-col sm:items-end sm:gap-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right sm:shadow-none">
                        <span className="text-xs font-bold leading-none tabular-nums sm:text-sm sm:font-semibold">
                          {routeMode === "drive" ? nextStop.driveMin : nextStop.walkMin} min
                        </span>
                        <span className="text-[10px] leading-none text-muted-foreground sm:mt-0.5 sm:text-[11px]">{routeMode}</span>
                      </div>
                    </div>

                    <p className="line-clamp-1 text-xs leading-relaxed text-white/85 sm:line-clamp-3 sm:text-sm sm:text-muted-foreground">{nextStop.tip}</p>

                    {isInactiveRecommendation ? (
                      <div className="mt-1 flex flex-wrap gap-2 sm:mt-auto">
                        <button
                          type="button"
                          onClick={() => runGatedAction(() => setOpenSpotId(nextStop.id))}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/90 sm:min-h-9 sm:bg-foreground sm:px-3.5 sm:py-2 sm:font-medium sm:text-background sm:hover:bg-foreground/90"
                        >
                          <Eye className="size-3.5" /> View spot
                        </button>
                        <button
                          type="button"
                          onClick={() => runGatedAction(() => setRouteOpen(true))}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/70 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 sm:min-h-9 sm:border-border sm:bg-transparent sm:px-3.5 sm:py-2 sm:font-medium sm:text-foreground sm:hover:bg-secondary"
                        >
                          <Navigation className="size-3.5" /> Route
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (isPlanningTrip) {
                            handleStartRoute(nextStop);
                            return;
                          }

                          runGatedAction(() => setRouteOpen(true));
                        }}
                        className="mt-1 inline-flex min-h-8 self-start items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/90 sm:mt-auto sm:min-h-9 sm:bg-foreground sm:px-3.5 sm:py-2 sm:font-medium sm:text-background sm:hover:bg-foreground/90"
                      >
                        <Navigation className="size-3.5" /> {stopActionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-t-[2rem] border border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-muted-foreground shadow-2xl shadow-foreground/15 sm:rounded-2xl sm:pb-4 sm:shadow-sm">
              No Namibia spots in this category yet.
            </div>
          )}
        </div>
      </div>

      {showDesktopTripPanel ? (
        <div className="absolute bottom-0 left-0 top-0 z-30 hidden w-96 animate-in slide-in-from-left-6 duration-300 border-r border-border shadow-xl lg:block">
          <TripPanel
            title="Your trip"
            spots={allSpots}
            tripData={tripPanelData}
            selectedSpot={openSpot}
            routedSpotId={routedSpotId}
            onAddSpot={handleAddSpotToTrip}
            onRemoveStop={(tripStopId) => runGatedAction(() => void removeTripStop({ tripStopId: tripStopId as Id<"tripStops"> }))}
            onMoveStop={(tripStopId, direction) => runGatedAction(() => {
              if (!effectiveTripData?.trip) {
                return;
              }

              runOfflineCapableTripAction(createOfflineAction({
                tripId: effectiveTripData.trip._id,
                type: "moveStop",
                tripStopId,
                direction,
              }));
            })}
            onStartTrip={(tripId) => runGatedAction(() => void startTrip({ tripId: tripId as Id<"trips"> }))}
            onRouteStop={handleRouteSpot}
            onMarkDone={(tripStopId) => runGatedAction(() => {
              if (!effectiveTripData?.trip) {
                return;
              }

              runOfflineCapableTripAction(createOfflineAction({
                tripId: effectiveTripData.trip._id,
                type: "markDone",
                tripStopId,
              }));
            })}
            onSkipStop={(tripStopId) => runGatedAction(() => {
              if (!effectiveTripData?.trip) {
                return;
              }

              runOfflineCapableTripAction(createOfflineAction({
                tripId: effectiveTripData.trip._id,
                type: "skip",
                tripStopId,
              }));
            })}
            onRouteModeChange={(tripId, mode) => runGatedAction(() => runOfflineCapableTripAction(createOfflineAction({
              tripId,
              type: "setRouteMode",
              routeMode: mode,
            })))}
          />
        </div>
      ) : null}

      <Drawer open={tripSheetOpen} onOpenChange={setTripSheetOpen}>
        <DrawerContent className="h-[88dvh] max-h-[88dvh] rounded-t-[1.75rem] border-border bg-card p-0 lg:hidden">
          <DrawerTitle className="sr-only">Your adventure</DrawerTitle>
          <TripPanel
            title="Your trip"
            spots={allSpots}
            tripData={tripPanelData}
            selectedSpot={openSpot}
            routedSpotId={routedSpotId}
            onAddSpot={handleAddSpotToTrip}
            onRemoveStop={(tripStopId) => runGatedAction(() => void removeTripStop({ tripStopId: tripStopId as Id<"tripStops"> }))}
            onMoveStop={(tripStopId, direction) => runGatedAction(() => {
              if (!effectiveTripData?.trip) {
                return;
              }

              runOfflineCapableTripAction(createOfflineAction({
                tripId: effectiveTripData.trip._id,
                type: "moveStop",
                tripStopId,
                direction,
              }));
            })}
            onStartTrip={(tripId) => runGatedAction(() => {
              void startTrip({ tripId: tripId as Id<"trips"> });
              setTripSheetOpen(false);
            })}
            onRouteStop={(spot) => {
              handleRouteSpot(spot);
              setTripSheetOpen(false);
            }}
            onMarkDone={(tripStopId) => runGatedAction(() => {
              if (!effectiveTripData?.trip) {
                return;
              }

              runOfflineCapableTripAction(createOfflineAction({
                tripId: effectiveTripData.trip._id,
                type: "markDone",
                tripStopId,
              }));
            })}
            onSkipStop={(tripStopId) => runGatedAction(() => {
              if (!effectiveTripData?.trip) {
                return;
              }

              runOfflineCapableTripAction(createOfflineAction({
                tripId: effectiveTripData.trip._id,
                type: "skip",
                tripStopId,
              }));
            })}
            onRouteModeChange={(tripId, mode) => runGatedAction(() => runOfflineCapableTripAction(createOfflineAction({
              tripId,
              type: "setRouteMode",
              routeMode: mode,
            })))}
          />
        </DrawerContent>
      </Drawer>

      {/* Spot details modal */}
      <SpotModal
        spot={openSpot}
        isNextStop={openSpot?.id === nextStop?.id}
        isInTrip={openSpot ? hasTripSpot(tripStops, openSpot.id) : false}
        onClose={() => setOpenSpotId(null)}
        onSetNextStop={(spot) => {
          const exploreSpot = allSpots.find((candidate) => candidate.id === spot.id);
          if (exploreSpot) {
            handleSetNextStop(exploreSpot);
          }
        }}
        onRoute={(spot) => {
          const exploreSpot = allSpots.find((candidate) => candidate.id === spot.id);
          if (exploreSpot) {
            handleRouteSpot(exploreSpot);
          }
        }}
        onAddToTrip={(s) => {
          const exploreSpot = allSpots.find((candidate) => candidate.id === s.id);
          if (exploreSpot) {
            handleAddSpotToTrip(exploreSpot);
          }
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
