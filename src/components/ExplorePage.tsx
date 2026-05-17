"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import MapboxStreetsMap from "@/components/MapboxStreetsMap";
import { Search, Coffee, Eye, Gem, Map, Route as RouteIcon, Navigation, SlidersHorizontal, ChevronDown, ListChecks, MapPin, Bed, Utensils, Landmark } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AuthDialog } from "@/components/AuthDialog";
import { AuthStatus } from "@/components/AuthStatus";
import type { RouteSummary } from "@/components/MapboxStreetsMap";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { MapWarmup } from "@/components/MapWarmup";
import { MapSkeleton } from "@/components/MapSkeleton";
import { BottomNav } from "@/components/BottomNav";
import { ExploreLoadingSkeleton } from "@/components/ExploreLoadingSkeleton";
import { useUserLocation } from "@/hooks/useUserLocation";
import RoutePanel from "@/components/RoutePanel";
import { SpotImage } from "@/components/SpotImage";
import SpotModal from "@/components/SpotModal";
import TripPanel from "@/components/TripPanel";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import type { Destination, Spot, WandrCatalog } from "@/data/destinations";
import {
  applyOfflineAction,
  createOfflineAction,
  readActiveTripSnapshot,
  readCatalogSnapshot,
  readOfflineTripQueue,
  saveActiveTripSnapshot,
  clearActiveTripSnapshot,
  saveCatalogSnapshot,
  saveOfflineTripQueue,
  type ActiveTripSnapshot,
  type OfflineTripAction,
  type PersistedTripData,
} from "@/lib/activeTripPersistence";
import {
  buildDirectionsUrl,
  buildRouteCacheKey,
  cacheImage,
  cacheResponse,
  estimateOfflineDownload,
  fetchAndCacheRoute,
  listOfflineAreas,
  saveOfflineArea,
  spotsInsideRadius,
  type OfflineAreaRecord,
} from "@/lib/offlineMapStorage";
import { getCurrentStop, getRouteStopIds, getTripProgress, hasTripSpot, orderedTripStops } from "@/lib/tripPlanner";

const fallbackCategories = [
  { id: "all", label: "All", mobileLabel: "All", icon: Map },
  { id: "eat", label: "Eat", mobileLabel: "Eat", icon: Coffee },
  { id: "see", label: "See", mobileLabel: "See", icon: Eye },
  { id: "gems", label: "Hidden gems", mobileLabel: "Gems", icon: Gem },
  { id: "routes", label: "Routes", mobileLabel: "Routes", icon: RouteIcon },
] as const;
const typeIcons = { coffee: Coffee, eye: Eye, gem: Gem, route: RouteIcon, bed: Bed, food: Utensils, landmark: Landmark, "map-pin": MapPin } as const;

type GatedAction = () => void;

type ExplorePageProps = {
  initialDestinationId?: string;
  children?: React.ReactNode;
};

type ExploreSpot = Spot & {
  destinationId: string;
  destinationCity: string;
  destinationCountry: string;
};

const defaultMapConfig = {
  center: [0, 0] as [number, number],
  zoom: 2,
  label: "World",
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

function isWandrCatalog(value: unknown): value is WandrCatalog {
  return Boolean(value && typeof value === "object" && Array.isArray((value as WandrCatalog).destinations));
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

const ExplorePage = ({ initialDestinationId: _initialDestinationId, children }: ExplorePageProps) => {
  const pathname = usePathname();
  const isRootRoute = pathname === "/";
  const { position: userPosition } = useUserLocation();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const remoteWandrCatalogData = useQuery(api.content.listWandrPicksPublic, {});
  const remoteLegacyCatalogData = useQuery(api.content.listPublic, {});
  const [catalogData, setCatalogData] = useState<unknown>(() => readCatalogSnapshot());

  useEffect(() => {
    const nextCatalog = isWandrCatalog(remoteWandrCatalogData)
      ? remoteWandrCatalogData
      : remoteLegacyCatalogData;
    if (nextCatalog !== undefined && nextCatalog !== null) {
      setCatalogData(nextCatalog);
      saveCatalogSnapshot(nextCatalog);
    }
  }, [remoteLegacyCatalogData, remoteWandrCatalogData]);

  const catalog = useMemo(() => (isWandrCatalog(catalogData) ? catalogData : null), [catalogData]);
  const destinations = useMemo(() => catalog?.destinations ?? (isDestinationList(catalogData) ? catalogData : []), [catalog, catalogData]);
  const categories = useMemo(() => {
    if (!catalog?.types?.length) return fallbackCategories;
    return [
      { id: "all", label: "All", mobileLabel: "All", icon: Map },
      ...catalog.types.map((type) => ({
        id: type.slug,
        label: type.pluralLabel,
        mobileLabel: type.label,
        icon: typeIcons[type.icon as keyof typeof typeIcons] ?? MapPin,
      })),
    ];
  }, [catalog?.types]);
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
  const [activeCat, setActiveCat] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [fallbackNextStopId, setFallbackNextStopId] = useState<string | null>(localSnapshot?.routedSpotId ?? null);
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);
  const [fallbackRouteMode, setFallbackRouteMode] = useState<"walk" | "drive">("walk");
  const [routeOpen, setRouteOpen] = useState(() => Boolean(localSnapshot?.routeOpen));
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [offlineRadiusKm, setOfflineRadiusKm] = useState(3);
  const [offlineAreas, setOfflineAreas] = useState<OfflineAreaRecord[]>([]);
  const [isDownloadingArea, setIsDownloadingArea] = useState(false);
  const [offlineDownloadError, setOfflineDownloadError] = useState<string | null>(null);
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [desktopTripPanelOpen, setDesktopTripPanelOpen] = useState(true);
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
  const startFeaturedPlan = useMutation(api.trips.startFeaturedPlan);
  const syncOfflineAction = useMutation(api.trips.syncOfflineAction);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const syncingRef = useRef(false);

  const filteredSpots = useMemo(() => {
    if (!searchQuery.trim()) {
      return allSpots;
    }
    const q = searchQuery.toLowerCase().trim();
    return allSpots.filter((spot) => {
      return (
        spot.name.toLowerCase().includes(q) ||
        spot.tag.toLowerCase().includes(q) ||
        spot.tip.toLowerCase().includes(q) ||
        spot.category.toLowerCase().includes(q) ||
        spot.destinationCity.toLowerCase().includes(q) ||
        spot.destinationCountry.toLowerCase().includes(q) ||
        (spot.tags && spot.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [allSpots, searchQuery]);

  const visibleSpots = useMemo(
    () => filteredSpots.filter((s) => activeCat === "all" || s.category === activeCat),
    [filteredSpots, activeCat]
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
  const featuredPlans = catalog?.featuredPlans ?? [];
  const tripProgress = getTripProgress(tripStops);
  const hasDesktopTripPanel = tripProgress.total > 0;
  const showDesktopTripPanel = hasDesktopTripPanel && desktopTripPanelOpen;
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

  const activeMapConfig = useMemo(() => {
    if (searchQuery.trim() && filteredSpots.length > 0) {
      const firstMatch = filteredSpots.filter((s) => activeCat === "all" || s.category === activeCat)[0];
      if (firstMatch) {
        return {
          center: firstMatch.lngLat as [number, number],
          zoom: 14,
          label: firstMatch.name,
        };
      }
    }
    if (destinations.length > 0 && destinations[0].map) {
      return { ...destinations[0].map, label: destinations[0].city };
    }
    return defaultMapConfig;
  }, [destinations, searchQuery, filteredSpots, activeCat]);

  const offlineCenter = userPosition?.lngLat ?? nextStop?.lngLat ?? activeMapConfig.center;
  const offlineRadiusMeters = offlineRadiusKm * 1000;
  const offlineAreaSpots = useMemo(
    () => spotsInsideRadius(allSpots, offlineCenter, offlineRadiusMeters),
    [allSpots, offlineCenter, offlineRadiusMeters],
  );
  const offlineEstimateMb = useMemo(
    () => estimateOfflineDownload(offlineAreaSpots, offlineRadiusMeters),
    [offlineAreaSpots, offlineRadiusMeters],
  );
  const latestOfflineArea = offlineAreas
    .filter((area) => area.status === "ready")
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;

  useEffect(() => {
    if (fallbackNextStopId || allSpots.length === 0) {
      return;
    }

    const firstDestination = destinations[0];
    if (firstDestination?.featuredSpotId) {
      const featuredSpot = allSpots.find(s => s.id === firstDestination.featuredSpotId);
      if (featuredSpot) {
        setFallbackNextStopId(featuredSpot.id);
        return;
      }
    }

    setFallbackNextStopId(allSpots[0].id);
  }, [allSpots, destinations, fallbackNextStopId]);

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
    if (searchQuery.trim()) {
      const match = filteredSpots.find((s) => activeCat === "all" || s.category === activeCat);
      if (match) {
        setFallbackNextStopId(match.id);
      }
    }
  }, [filteredSpots, searchQuery, activeCat]);

  useEffect(() => {
    saveOfflineTripQueue(offlineQueue);
  }, [offlineQueue]);

  useEffect(() => {
    void listOfflineAreas().then(setOfflineAreas);
  }, []);

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
      destinationId: effectiveTripData.trip.destinationId ?? "",
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
    setOpenSpotId(spotId);
  }, []);

  const handleOnboardingComplete = () => {
    setOnboardingOpen(false);
  };

  const handleCloseCompletedTrip = useCallback(() => {
    setLocalSnapshot(null);
    setOptimisticTripData(null);
    clearActiveTripSnapshot();
    setTripSheetOpen(false);
    setDesktopTripPanelOpen(false);
  }, []);

  const buildCurrentSnapshot = useCallback((): ActiveTripSnapshot | null => {
    if (!effectiveTripData?.trip) {
      return null;
    }

    return {
      trip: effectiveTripData.trip,
      stops: effectiveTripData.stops,
      destinationId: effectiveTripData.trip.destinationId ?? "",
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

  const handleStartFeaturedPlan = useCallback(
    (planId: string) => {
      runGatedAction(() => {
        void startFeaturedPlan({ planId: planId as Id<"featuredTravelPlans"> }).then((payload) => {
          setOptimisticTripData(payload);
          setTripSheetOpen(true);
        });
      });
    },
    [runGatedAction, startFeaturedPlan],
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

  const handleDownloadOfflineArea = useCallback(async () => {
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!accessToken || isDownloadingArea) {
      setOfflineDownloadError(accessToken ? null : "Mapbox token missing.");
      return;
    }

    setIsDownloadingArea(true);
    setOfflineDownloadError(null);

    const startedAt = Date.now();
    const areaId = `area-${startedAt}`;
    const areaSpots = offlineAreaSpots.length > 0 ? offlineAreaSpots : nextStop ? [nextStop] : [];
    const routeKeys: string[] = [];

    try {
      await Promise.allSettled([
        cacheResponse("/api/catalog", "wandr-pwa-v7"),
        cacheResponse(`https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${accessToken}`),
      ]);

      await Promise.allSettled(areaSpots.map((spot) => cacheImage(spot.image)));

      const routeJobs: Array<{ origin: [number, number]; stops: [number, number][]; mode: "walk" | "drive" }> = [];
      const activeRouteStops = routeStopsForMap.length > 0 ? routeStopsForMap : nextStop ? [nextStop] : [];

      if (activeRouteStops.length > 0) {
        routeJobs.push({ origin: offlineCenter, stops: activeRouteStops.map((spot) => spot.lngLat), mode: routeMode });
      }

      for (const spot of areaSpots) {
        routeJobs.push({ origin: offlineCenter, stops: [spot.lngLat], mode: "walk" });
        routeJobs.push({ origin: offlineCenter, stops: [spot.lngLat], mode: "drive" });
      }

      for (const job of routeJobs.slice(0, 40)) {
        const key = buildRouteCacheKey(job.origin, job.stops, job.mode);
        routeKeys.push(key);
        try {
          await fetchAndCacheRoute(key, buildDirectionsUrl(job.origin, job.stops, job.mode, accessToken));
        } catch {
          // Keep the package useful even if one route fails.
        }
      }

      const record: OfflineAreaRecord = {
        id: areaId,
        label: nextStop ? `${nextStop.name} area` : activeMapConfig.label,
        center: offlineCenter,
        radiusMeters: offlineRadiusMeters,
        routeMode,
        spotIds: areaSpots.map((spot) => spot.id),
        routeKeys,
        createdAt: startedAt,
        updatedAt: Date.now(),
        status: "ready",
      };

      await saveOfflineArea(record);
      setOfflineAreas((current) => [record, ...current.filter((area) => area.id !== record.id)]);
    } catch {
      setOfflineDownloadError("Download failed.");
    } finally {
      setIsDownloadingArea(false);
    }
  }, [
    activeMapConfig.label,
    isDownloadingArea,
    nextStop,
    offlineAreaSpots,
    offlineCenter,
    offlineRadiusMeters,
    routeMode,
    routeStopsForMap,
  ]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || catalogData === undefined || (catalogData === null && remoteWandrCatalogData === undefined && remoteLegacyCatalogData === undefined)) {
    return <ExploreLoadingSkeleton children={children} />;
  }

  return (
    <main className="wandr-native-map-shell text-foreground">
      {/* Map */}
      <div className="absolute inset-0">
        <MapboxStreetsMap
          mapConfig={activeMapConfig}
          spots={visibleSpots}
          nextStop={nextStop}
          highlightedSpotId={highlightedSpotId}
          routeStops={routeStopsForMap}
          routeOpen={routeOpen}
          routeMode={routeMode}
          userPosition={userPosition}
          onOpenSpot={handleOpenSpot}
          onRouteSummaryChange={handleRouteSummaryChange}
        />

        {/* Offline indicator */}
        {!isOnline && (
          <div className="wandr-offline-badge">
            {latestOfflineArea ? `Offline: ${latestOfflineArea.label}` : "Offline"}
          </div>
        )}


      </div>

      {/* Top */}
      <header
        className={[
          "absolute left-0 right-0 top-0 z-30 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-[max(1.5rem,env(safe-area-inset-top))]",
          !isRootRoute ? "hidden" : "",
        ].join(" ")}
      >
        <div className="sm:hidden">
          <div className="relative w-full">
            {mobileSearchOpen ? (
              <form
                className="relative z-40 flex w-full items-center gap-2 rounded-full bg-card p-1.5 pl-3 ring-1 ring-border"
                onSubmit={(e) => {
                  e.preventDefault();
                  setMobileSearchOpen(false);
                }}
              >
                <Search className="size-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search places..."
                  className="min-w-0 flex-1 bg-transparent py-1 text-sm placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-xs text-muted-foreground hover:text-foreground px-2"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="relative z-40 flex w-full items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(true)}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-foreground ring-1 ring-border transition-colors active:bg-secondary"
                  aria-label="Search"
                >
                  <Search className="size-4" />
                </button>

                <div className="flex min-w-0 items-center justify-end gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMobileFilterOpen((open) => !open)}
                      className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full bg-card px-4 text-sm font-medium text-foreground ring-1 ring-border transition-colors active:bg-secondary"
                      aria-expanded={mobileFilterOpen}
                      aria-label="Filter places"
                    >
                      <SlidersHorizontal className="size-3.5 shrink-0" />
                      <span>{activeCategory.mobileLabel}</span>
                      <ChevronDown className={`size-3.5 shrink-0 transition-transform ${mobileFilterOpen ? "rotate-180" : ""}`} />
                    </button>

                    {mobileFilterOpen ? (
                      <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-card p-1">
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
                                "flex h-11 w-full items-center gap-2 rounded-full px-3.5 text-left text-sm font-medium transition-colors",
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
            )}

            {mobileFilterOpen ? (
              <div className="fixed inset-0 z-30" onClick={() => setMobileFilterOpen(false)} />
            ) : null}
          </div>
        </div>

        <div
          className={[
            "relative hidden sm:block",
          ].join(" ")}
        >
          <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between gap-4">
            <h1 className="pointer-events-auto rounded-full bg-card px-4 py-2.5 text-base font-bold leading-5 ring-1 ring-border lg:text-xl">
              Wandr
            </h1>
            <div className="pointer-events-auto flex items-center gap-2">
              <AuthStatus
                userName={currentUser?.name}
                userEmail={currentUser?.email}
                onSignIn={() => setAuthOpen(true)}
              />
            </div>
          </div>

          <div
            className={[
              "mx-auto flex w-full max-w-2xl flex-col gap-3",
            ].join(" ")}
          >
            <form
              className="flex items-center gap-3 rounded-2xl bg-card p-2 pl-4 ring-1 ring-border"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Where should we go today?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 w-full bg-transparent py-2 text-[16px] placeholder:text-muted-foreground focus:outline-none sm:text-base"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-muted-foreground hover:text-foreground px-2"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
              >
                Ask
              </button>
            </form>

            <div className="-mx-3 flex justify-center gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
              {categories.map((c) => {
                const isActive = activeCat === c.id;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={[
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                      isActive ? "bg-foreground text-background" : "bg-secondary text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    <Icon className="size-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>

            {featuredPlans.length > 0 ? (
              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
                {featuredPlans.slice(0, 4).map((plan) => (
                  <button
                    key={plan._id}
                    type="button"
                    onClick={() => handleStartFeaturedPlan(plan._id)}
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-secondary"
                  >
                    <RouteIcon className="size-3.5" />
                    {plan.title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Bottom */}
      <div
        className={[
          "wandr-bottom-sheet absolute bottom-[5.25rem] left-0 right-0 z-30 px-3 sm:bottom-0 sm:px-8 sm:pb-8",
          !isRootRoute ? "hidden" : "",
        ].join(" ")}
      >
        <div className="mx-auto flex w-full flex-col sm:max-w-2xl sm:gap-3">
          {nextStop && routeOpen ? (
            <div className="wandr-bottom-surface overflow-hidden rounded-2xl bg-card p-2 ring-1 ring-border sm:bg-transparent sm:p-0 sm:ring-0">
              <div className="mx-auto mb-3 h-1 w-7 rounded-full bg-muted sm:hidden" />
              <RoutePanel
                spot={nextStop}
                mode={routeMode}
                summary={routeSummary}
                isActive={effectiveTripData?.trip.status === "active"}
                isOnline={isOnline}
                onModeChange={handleSetRouteMode}
                onClose={() => setRouteOpen(false)}
                onStart={() => handleStartRoute(nextStop)}
              />
            </div>
          ) : nextStop ? (
            <div className="wandr-bottom-surface overflow-hidden rounded-2xl bg-card p-2 ring-1 ring-border sm:bg-transparent sm:p-0 sm:ring-0">
              <div className="mx-auto mb-3 h-1 w-7 rounded-full bg-muted sm:hidden" />
              <div className="mb-4 flex items-center justify-between gap-3 sm:hidden">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ListChecks className="size-3.5" />
                    {isActiveTrip ? "Active trip" : isPlanningTrip ? "Trip ready" : "Start a trip"}
                  </div>
                  <div className="mt-0.5 truncate text-xl font-bold leading-7 text-foreground">
                    {tripProgress.total > 0 ? `${tripProgress.total} stop${tripProgress.total === 1 ? "" : "s"}` : "Suggested stop"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => runGatedAction(() => setTripSheetOpen(true))}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
                  aria-label={`Open trip with ${tripProgress.total} stops`}
                >
                  Trip
                </button>
              </div>

              <div
                onClick={() => setOpenSpotId(nextStop.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenSpotId(nextStop.id);
                  }
                }}
                className="wandr-recommendation-card group mx-auto w-full overflow-hidden rounded-2xl bg-foreground text-left text-background ring-1 ring-border transition-transform active:scale-[0.99] sm:max-w-xl sm:bg-card sm:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative min-h-[11rem] sm:flex sm:items-stretch sm:min-h-[8.5rem]">
                  <div className="absolute inset-0 sm:relative sm:w-[8.5rem] sm:shrink-0 sm:min-h-[8.5rem]">
                    <SpotImage
                      src={nextStop.image}
                      alt={nextStop.name}
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(min-width: 640px) 8.5rem, 100vw"
                      fill
                      priority
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent sm:hidden" />
                  <div className="relative flex min-h-[11rem] min-w-0 flex-col justify-end p-4 sm:flex-1 sm:min-h-0 sm:justify-start sm:gap-1 sm:p-3">

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium text-white/80 sm:text-muted-foreground">
                          {isInactiveRecommendation ? <span className="sr-only">You might like this</span> : null}
                          {isInactiveRecommendation ? "Featured" : stopCardLabel}
                        </div>
                        <h2 className="mt-1 line-clamp-2 text-2xl font-bold leading-8 text-white sm:text-base sm:font-semibold sm:leading-tight sm:text-foreground">{nextStop.name}</h2>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-white sm:flex-col sm:items-end sm:gap-0 sm:bg-secondary sm:px-2.5 sm:py-1 sm:text-foreground">
                        <span className="text-sm font-medium leading-none tabular-nums sm:text-xs">
                          {routeMode === "drive" ? nextStop.driveMin : nextStop.walkMin} min
                        </span>
                        <span className="text-[11px] leading-none text-white/80 sm:mt-0.5 sm:text-[10px] sm:text-muted-foreground">{routeMode}</span>
                      </div>
                    </div>

                    <p className="mt-1 line-clamp-2 text-sm font-normal leading-5 text-white/90 sm:line-clamp-2 sm:text-xs sm:leading-normal sm:text-muted-foreground">{nextStop.tip}</p>

                    {isInactiveRecommendation ? (
                      <div className="mt-3 flex flex-wrap gap-2 sm:mt-auto sm:gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            runGatedAction(() => setRouteOpen(true));
                          }}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/90 sm:min-h-8 sm:h-8 sm:px-3 sm:py-1 sm:text-xs sm:bg-foreground sm:text-background sm:hover:bg-foreground/80"
                        >
                          <Navigation className="size-4 sm:size-3.5" /> Route
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPlanningTrip) {
                            handleStartRoute(nextStop);
                            return;
                          }

                          runGatedAction(() => setRouteOpen(true));
                        }}
                        className="mt-4 inline-flex min-h-11 self-start items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/90 sm:mt-auto sm:min-h-8 sm:h-8 sm:px-3 sm:py-1 sm:text-xs sm:bg-foreground sm:text-background sm:hover:bg-foreground/80"
                      >
                        <Navigation className="size-4 sm:size-3.5" /> {stopActionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="wandr-bottom-surface rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground ring-1 ring-border">
              No Wandr Picks yet.
            </div>
          )}
        </div>
      </div>

      {showDesktopTripPanel && isRootRoute ? (
        <div className="absolute bottom-6 left-6 top-6 z-40 hidden w-[min(24rem,calc(100vw-3rem))] overflow-hidden rounded-[2rem] bg-card shadow-2xl ring-1 ring-border animate-in slide-in-from-left-6 duration-300 lg:block">
          <TripPanel
            title="Your trip"
            spots={allSpots}
            tripData={tripPanelData}
            selectedSpot={openSpot}
            routedSpotId={routedSpotId}
            onClose={() => setDesktopTripPanelOpen(false)}
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
            onCloseTrip={handleCloseCompletedTrip}
          />
        </div>
      ) : null}

      {hasDesktopTripPanel && !desktopTripPanelOpen && isRootRoute ? (
        <button
          type="button"
          onClick={() => setDesktopTripPanelOpen(true)}
          className="absolute left-6 top-24 z-40 hidden min-h-11 items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-lg ring-1 ring-border transition-colors hover:bg-secondary lg:inline-flex"
          aria-label={`Open trip panel with ${tripProgress.total} stops`}
        >
          <ListChecks className="size-4" />
          Trip
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {tripProgress.total}
          </span>
        </button>
      ) : null}

      <Drawer open={tripSheetOpen} onOpenChange={setTripSheetOpen}>
        <DrawerContent className="h-[88dvh] max-h-[88dvh] rounded-t-2xl border-border bg-card p-0 lg:hidden">
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
            onCloseTrip={handleCloseCompletedTrip}
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
      {/* Map Pre-warmer for offline caching */}
      <MapWarmup destinations={destinations} accessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN} />
      {/* Bottom navigation */}
      <div style={{ display: isRootRoute ? "block" : "none" }}>
        <BottomNav onTripsClick={() => runGatedAction(() => setTripSheetOpen(true))} />
      </div>

      {children && (
        <div
          className="absolute inset-0 z-[100] bg-background overflow-y-auto"
          style={{ display: isRootRoute ? "none" : "block" }}
        >
          {children}
        </div>
      )}
    </main>
  );
};

export default ExplorePage;
