"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Archive, Loader2, Pencil, Plus, RotateCcw, ShieldCheck, Star, MapPin, Globe, Check, Image as ImageIcon, Trash2, ArrowLeft } from "lucide-react";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AdminMapPicker } from "@/components/AdminMapPicker";

type Category = "eat" | "see" | "gems" | "routes";
type SpotStatus = "active" | "archived";

type AdminDestination = {
  _id: Id<"destinations">;
  id?: string;
  city?: string;
  country?: string;
  flag?: string;
  featuredSpotId?: Id<"spots">;
  map?: { center: [number, number]; zoom: number };
  status: SpotStatus;
  archivedAt: number | null;
};

type AdminSpot = {
  _id: Id<"spots">;
  destinationId: Id<"destinations">;
  slug: string;
  name?: string;
  category?: Category;
  top?: string;
  left?: string;
  lngLat?: [number, number];
  walkMin?: number;
  driveMin?: number;
  tip?: string;
  tag?: string;
  image?: string;
  status: SpotStatus;
  archivedAt: number | null;
};

const categories: Array<{ id: Category; label: string }> = [
  { id: "eat", label: "Eat" },
  { id: "see", label: "See" },
  { id: "gems", label: "Hidden gems" },
  { id: "routes", label: "Routes" },
];

const blankDestinationForm = {
  destinationId: "" as Id<"destinations"> | "",
  slug: "",
  city: "",
  country: "",
  flag: "",
  mapTop: "50%",
  mapLeft: "50%",
  mapCenterLng: "",
  mapCenterLat: "",
  mapZoom: "12",
  youTop: "50%",
  youLeft: "50%",
  youLngLatLng: "",
  youLngLatLat: "",
};

const blankSpotForm = {
  spotId: "" as Id<"spots"> | "",
  destinationId: "" as Id<"destinations"> | "",
  slug: "",
  name: "",
  category: "eat" as Category,
  longitude: "",
  latitude: "",
  top: "50%",
  left: "50%",
  walkMin: "10",
  driveMin: "5",
  tag: "",
  tip: "",
  image: "/placeholder.svg",
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const isAdmin = currentUser?.role === "admin";
  const adminData = useQuery(api.content.adminList, isAdmin ? {} : "skip");

  const createSpot = useMutation(api.content.createSpot);
  const updateSpot = useMutation(api.content.updateSpot);
  const archiveSpot = useMutation(api.content.archiveSpot);
  const restoreSpot = useMutation(api.content.restoreSpot);
  const setFeaturedSpot = useMutation(api.content.setFeaturedSpot);

  const createDestination = useMutation(api.content.createDestination);
  const updateDestination = useMutation(api.content.updateDestination);
  const archiveDestination = useMutation(api.content.archiveDestination);
  const restoreDestination = useMutation(api.content.restoreDestination);
  const deleteDestination = useMutation(api.content.deleteDestination);
  const deleteSpot = useMutation(api.content.deleteSpot);
  const resetDatabase = useMutation(api.content.resetDatabase);

  const [activeTab, setActiveTab] = useState<"destinations" | "spots">("spots");
  const [selectedDestinationId, setSelectedDestinationId] = useState<Id<"destinations"> | "">("");
  const [showArchived, setShowArchived] = useState(false);
  
  const [spotForm, setSpotForm] = useState(blankSpotForm);
  const [destForm, setDestForm] = useState(blankDestinationForm);
  const [isSpotModalOpen, setIsSpotModalOpen] = useState(false);
  const [isDestModalOpen, setIsDestModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const generateUploadUrl = useMutation(api.content.generateUploadUrl);

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const destinations = (adminData?.destinations ?? []).filter(
    (destination): destination is AdminDestination => Boolean(destination?._id),
  );
  const spots = (adminData?.spots ?? []).filter((spot): spot is AdminSpot => Boolean(spot?._id));
  const selectedDestination = destinations.find((destination) => destination._id === selectedDestinationId) ?? destinations[0];

  useEffect(() => {
    if (!selectedDestinationId && destinations[0]) {
      setSelectedDestinationId(destinations[0]._id);
      setSpotForm((current) => ({ ...current, destinationId: destinations[0]._id }));
    }
  }, [destinations, selectedDestinationId]);

  const visibleSpots = useMemo(() => {
    if (!selectedDestination) return [];
    return spots
      .filter((spot) => spot.destinationId === selectedDestination._id)
      .filter((spot) => showArchived || (spot.status ?? "active") === "active")
      .sort((a, b) => `${a.category ?? ""}-${a.name ?? ""}`.localeCompare(`${b.category ?? ""}-${b.name ?? ""}`));
  }, [selectedDestination, showArchived, spots]);

  const groupedSpots = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        spots: visibleSpots.filter((spot) => spot.category === category.id),
      })),
    [visibleSpots],
  );

  const visibleDestinations = useMemo(() => {
    return destinations.filter(d => showArchived || (d.status ?? "active") === "active");
  }, [destinations, showArchived]);

  // Handle Spotlight/Message Timeout
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  // Destination Form Handlers
  const resetDestForm = () => {
    setDestForm(blankDestinationForm);
    setError(null);
  };

  const editDest = (dest: AdminDestination) => {
    setDestForm({
      destinationId: dest._id,
      slug: dest.id || "",
      city: dest.city || "",
      country: dest.country || "",
      flag: dest.flag || "",
      mapTop: "50%",
      mapLeft: "50%",
      mapCenterLng: String(dest.map?.center[0] ?? 0),
      mapCenterLat: String(dest.map?.center[1] ?? 0),
      mapZoom: String(dest.map?.zoom ?? 12),
      youTop: "50%",
      youLeft: "50%",
      youLngLatLng: String(dest.map?.center[0] ?? 0),
      youLngLatLat: String(dest.map?.center[1] ?? 0),
    });
    setIsDestModalOpen(true);
  };

  const submitDestForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const payload = {
        slug: slugify(destForm.slug || destForm.city),
        city: destForm.city,
        country: destForm.country,
        flag: destForm.flag,
        mapTop: destForm.mapTop,
        mapLeft: destForm.mapLeft,
        mapCenter: [Number(destForm.mapCenterLng), Number(destForm.mapCenterLat)],
        mapZoom: Number(destForm.mapZoom),
        youTop: destForm.youTop,
        youLeft: destForm.youLeft,
        youLngLat: [Number(destForm.youLngLatLng), Number(destForm.youLngLatLat)],
      };

      if (destForm.destinationId) {
        await updateDestination({ destinationId: destForm.destinationId, ...payload });
        setMessage("Destination updated.");
      } else {
        await createDestination(payload);
        setMessage("Destination added.");
      }
      setIsDestModalOpen(false);
      resetDestForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save destination.");
    } finally {
      setPending(false);
    }
  };

  // Spot Form Handlers
  const resetSpotForm = (destId = selectedDestination?._id ?? "") => {
    setSpotForm({ ...blankSpotForm, destinationId: destId });
    setError(null);
  };

  const editSpot = (spot: AdminSpot) => {
    setSpotForm({
      spotId: spot._id,
      destinationId: spot.destinationId,
      slug: spot.slug,
      name: spot.name ?? "",
      category: spot.category ?? "eat",
      longitude: String(spot.lngLat?.[0] ?? ""),
      latitude: String(spot.lngLat?.[1] ?? ""),
      top: spot.top ?? "50%",
      left: spot.left ?? "50%",
      walkMin: String(spot.walkMin ?? 10),
      driveMin: String(spot.driveMin ?? 5),
      tag: spot.tag ?? "",
      tip: spot.tip ?? "",
      image: spot.image ?? "/placeholder.svg",
    });
    setSelectedDestinationId(spot.destinationId);
    setIsSpotModalOpen(true);
  };

  const submitSpotForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const payload = {
        destinationId: spotForm.destinationId as Id<"destinations">,
        slug: slugify(spotForm.slug || spotForm.name),
        name: spotForm.name,
        category: spotForm.category,
        top: spotForm.top,
        left: spotForm.left,
        lngLat: [Number(spotForm.longitude), Number(spotForm.latitude)],
        walkMin: Number(spotForm.walkMin),
        driveMin: Number(spotForm.driveMin),
        tip: spotForm.tip,
        tag: spotForm.tag,
        image: spotForm.image,
      };

      if (spotForm.spotId) {
        await updateSpot({ spotId: spotForm.spotId, ...payload });
        setMessage("Spot updated.");
      } else {
        await createSpot(payload);
        setMessage("Spot added.");
      }
      setIsSpotModalOpen(false);
      resetSpotForm(payload.destinationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save spot.");
    } finally {
      setPending(false);
    }
  };

  const setSpotArchived = async (spotId: Id<"spots">, archived: boolean) => {
    try {
      if (archived) {
        await archiveSpot({ spotId });
        setMessage("Spot archived.");
      } else {
        await restoreSpot({ spotId });
        setMessage("Spot restored.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    }
  };

  const setDestArchived = async (destinationId: Id<"destinations">, archived: boolean) => {
    try {
      if (archived) {
        await archiveDestination({ destinationId });
        setMessage("Destination archived.");
      } else {
        await restoreDestination({ destinationId });
        setMessage("Destination restored.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    }
  };

  const handleDeleteDest = async (destinationId: Id<"destinations">) => {
    if (!confirm("Are you sure you want to PERMANENTLY delete this destination and ALL its spots?")) return;
    try {
      await deleteDestination({ destinationId });
      setMessage("Destination deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    }
  };

  const handleDeleteSpot = async (spotId: Id<"spots">) => {
    if (!confirm("Are you sure you want to PERMANENTLY delete this spot?")) return;
    try {
      await deleteSpot({ spotId });
      setMessage("Spot deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm("CRITICAL: This will PERMANENTLY delete EVERYTHING (Destinations, Spots, User Trips). Continue?")) return;
    try {
      await resetDatabase({});
      setMessage("Database reset complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    }
  };

  const handleSetFeatured = async (spotId: Id<"spots">) => {
    try {
      if (selectedDestinationId) {
        await setFeaturedSpot({ destinationId: selectedDestinationId, spotId });
        setMessage("Set as recommended spot.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set featured spot.");
    }
  };

  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // 1. Get a short-lived upload URL
      const postUrl = await generateUploadUrl();

      // 2. POST the file to the URL
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      // 3. Get the storageId from the response
      const { storageId } = await result.json();

      // 4. In a real app, we might store the storageId. 
      // But for this app, we'll use the public URL for simplicity and compatibility.
      // We can use a query to get the URL from the storageId, but here we'll just 
      // use the storageId and let the backend resolve it OR use a known format.
      // Actually, Convex has a standard way to get the URL:
      // https://<deployment>.convex.cloud/api/storage/<storageId>
      // But it's better to store the storageId and resolve it.
      // However, the current schema expects a string URL.
      
      // Let's use the storageId as the image for now, and I'll update the backend 
      // to resolve storageIds to URLs if they look like storageIds.
      // Or just get the URL now if possible.
      // Actually, I can't easily get the URL from the client without another call.
      
      // I'll just set the image to the storageId and update the backend to resolve it.
      setSpotForm(current => ({ ...current, image: storageId }));
      setMessage("Image uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = "";
    }
  };

  if (isLoading || (isAuthenticated && currentUser === undefined)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background text-foreground">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <section className="w-full max-w-sm rounded-2xl border border-border bg-card/50 p-8 text-center shadow-2xl backdrop-blur-xl">
          <ShieldCheck className="mx-auto size-10 text-accent/80" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Admin Access</h1>
          <p className="mt-2 text-sm text-muted-foreground">You must be logged in as an administrator.</p>
          <div className="mt-8 flex justify-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium hover:text-accent transition-colors">
              <ArrowLeft className="size-4" /> Return Home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background pb-20 text-foreground">
      {/* Toast Notifications */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        {message && (
          <div className="animate-in slide-in-from-top-4 fade-in duration-300 rounded-full bg-highlight/10 border border-highlight/20 px-4 py-2 text-sm font-medium text-highlight backdrop-blur shadow-sm flex items-center gap-2">
            <Check className="size-4" /> {message}
          </div>
        )}
        {error && (
          <div className="animate-in slide-in-from-top-4 fade-in duration-300 rounded-full bg-destructive/10 border border-destructive/20 px-4 py-2 text-sm font-medium text-destructive backdrop-blur shadow-sm">
            {error}
          </div>
        )}
      </div>

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldCheck className="size-6 text-accent" />
            <h1 className="text-xl font-bold tracking-tight">Wandr Dashboard</h1>
          </div>
          <div className="flex bg-secondary/50 rounded-full p-1 border border-border/50">
            <button
              onClick={() => setActiveTab("destinations")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === "destinations" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Destinations
            </button>
            <button
              onClick={() => setActiveTab("spots")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === "spots" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Spots
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            {activeTab === "destinations" ? "Manage Destinations" : "Curate Spots"}
          </h2>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-input bg-background"
              />
              Show archived
            </label>
            {activeTab === "destinations" ? (
              <div className="flex gap-2">
                <button
                  onClick={handleResetDatabase}
                  className="inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive transition-transform active:scale-95 shadow-sm"
                >
                  Reset DB
                </button>
                <button
                  onClick={() => { resetDestForm(); setIsDestModalOpen(true); }}
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform active:scale-95 shadow-sm"
                >
                  <Plus className="size-4" /> Add Destination
                </button>
              </div>
            ) : (
              <button
                onClick={() => { resetSpotForm(); setIsSpotModalOpen(true); }}
                disabled={!selectedDestinationId}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform active:scale-95 shadow-sm disabled:opacity-50"
              >
                <Plus className="size-4" /> Add Spot
              </button>
            )}
          </div>
        </div>

        {activeTab === "destinations" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleDestinations.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
                No destinations found. Create one to get started.
              </div>
            )}
            {visibleDestinations.map(dest => {
              const isArchived = dest.status === "archived";
              return (
                <div key={dest._id} className={`p-5 rounded-2xl border border-border bg-card shadow-sm flex flex-col gap-4 ${isArchived ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl" aria-hidden>{dest.flag}</span>
                      <div>
                        <h3 className="font-bold">{dest.city}</h3>
                        <p className="text-xs text-muted-foreground">{dest.country}</p>
                      </div>
                    </div>
                    {isArchived && <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-full text-[10px] font-medium">Archived</span>}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="size-3" /> /{dest.id}
                  </div>
                  <div className="mt-auto pt-4 border-t border-border flex justify-end gap-2">
                    <button
                      onClick={() => editDest(dest)}
                      className="size-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                    >
                      <Pencil className="size-4 text-foreground" />
                    </button>
                    {isArchived ? (
                      <button
                        onClick={() => setDestArchived(dest._id, false)}
                        className="size-8 rounded-full bg-highlight/10 flex items-center justify-center hover:bg-highlight/20 transition-colors"
                      >
                        <RotateCcw className="size-4 text-highlight" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setDestArchived(dest._id, true)}
                        className="size-8 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                      >
                        <Archive className="size-4 text-destructive" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteDest(dest._id)}
                      className="size-8 rounded-full bg-destructive/20 flex items-center justify-center hover:bg-destructive/30 transition-colors"
                      title="Hard Delete"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "spots" && (
          <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Select Destination</h3>
              {destinations.length === 0 && <p className="text-sm text-muted-foreground">No destinations available.</p>}
              {destinations.map(dest => (
                <button
                  key={dest._id}
                  onClick={() => {
                    setSelectedDestinationId(dest._id);
                    setSpotForm(current => ({ ...current, destinationId: dest._id }));
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors border ${selectedDestinationId === dest._id ? 'bg-accent/10 border-accent/20 text-accent font-medium' : 'bg-transparent border-transparent hover:bg-secondary text-foreground'}`}
                >
                  <span>{dest.flag}</span>
                  {dest.city}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {groupedSpots.map(group => (
                <div key={group.id} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between bg-secondary/50 px-5 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold">{group.label}</h3>
                    <span className="text-xs font-medium bg-background px-2 py-1 rounded-full border border-border">{group.spots.length}</span>
                  </div>
                  {group.spots.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-center text-muted-foreground bg-background/50">No {group.label.toLowerCase()} spots yet.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {group.spots.map(spot => {
                        const isArchived = spot.status === "archived";
                        const isFeatured = selectedDestination?.featuredSpotId === spot._id;
                        return (
                          <div key={spot._id} className={`flex items-center justify-between gap-4 px-5 py-4 ${isArchived ? 'opacity-60 bg-secondary/20' : 'bg-background hover:bg-secondary/10 transition-colors'}`}>
                            <div className="flex items-center gap-4 min-w-0">
                              {spot.image && spot.image !== "/placeholder.svg" ? (
                                <img src={spot.image} alt="" className="size-12 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="size-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                                  <ImageIcon className="size-5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold truncate">{spot.name}</h4>
                                  {isArchived && <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0">Archived</span>}
                                  {isFeatured && <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0">Recommended</span>}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">{spot.tip}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleSetFeatured(spot._id)}
                                className={`size-8 rounded-full flex items-center justify-center transition-colors ${isFeatured ? 'bg-accent text-background' : 'bg-secondary hover:bg-secondary/80 text-foreground'}`}
                                title="Set as Recommended"
                              >
                                <Star className="size-4" />
                              </button>
                              <button
                                onClick={() => editSpot(spot)}
                                className="size-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                              >
                                <Pencil className="size-4 text-foreground" />
                              </button>
                              {isArchived ? (
                                <button
                                  onClick={() => setSpotArchived(spot._id, false)}
                                  className="size-8 rounded-full bg-highlight/10 flex items-center justify-center hover:bg-highlight/20 transition-colors"
                                >
                                  <RotateCcw className="size-4 text-highlight" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setSpotArchived(spot._id, true)}
                                  className="size-8 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                                >
                                  <Archive className="size-4 text-destructive" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSpot(spot._id)}
                                className="size-8 rounded-full bg-destructive/20 flex items-center justify-center hover:bg-destructive/30 transition-colors"
                                title="Hard Delete"
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Spot Modal */}
      {isSpotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">{spotForm.spotId ? "Edit Spot" : "Add New Spot"}</h2>
              <button onClick={() => setIsSpotModalOpen(false)} className="text-muted-foreground hover:text-foreground p-2 -m-2">Close</button>
            </div>
            <div className="overflow-y-auto p-6">
              <form id="spot-form" onSubmit={submitSpotForm} className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-medium">
                    Name
                    <input value={spotForm.name} onChange={(e) => setSpotForm({ ...spotForm, name: e.target.value })} required className="h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Slug
                    <input value={spotForm.slug} onChange={(e) => setSpotForm({ ...spotForm, slug: e.target.value })} placeholder="Auto-generated" className="h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all" />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-1.5 text-sm font-medium">
                    Category
                    <select value={spotForm.category} onChange={(e) => setSpotForm({ ...spotForm, category: e.target.value as Category })} className="h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all">
                      {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Walk mins
                    <input value={spotForm.walkMin} onChange={(e) => setSpotForm({ ...spotForm, walkMin: e.target.value })} type="number" min="0" required className="h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Drive mins
                    <input value={spotForm.driveMin} onChange={(e) => setSpotForm({ ...spotForm, driveMin: e.target.value })} type="number" min="0" required className="h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all" />
                  </label>
                </div>

                <div className="grid gap-1.5 text-sm font-medium">
                  Map Location
                  <div className="overflow-hidden rounded-xl border border-input">
                    <AdminMapPicker
                      center={selectedDestination?.map?.center ?? [0, 0]}
                      zoom={selectedDestination?.map?.zoom ?? 2}
                      markerLngLat={spotForm.longitude && spotForm.latitude ? [Number(spotForm.longitude), Number(spotForm.latitude)] : null}
                      onChange={(lng, lat) => setSpotForm(current => ({ ...current, longitude: String(lng), latitude: String(lat) }))}
                      markerLabel={spotForm.name}
                    />
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span>Lng: {spotForm.longitude || "Not set"}</span>
                    <span>Lat: {spotForm.latitude || "Not set"}</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-medium">
                    Short Tagline
                    <input value={spotForm.tag} onChange={(e) => setSpotForm({ ...spotForm, tag: e.target.value })} required placeholder="e.g. Local classic" className="h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Image (URL or Upload)
                    <div className="flex gap-2">
                      <input 
                        value={spotForm.image} 
                        onChange={(e) => setSpotForm({ ...spotForm, image: e.target.value })} 
                        required 
                        placeholder="Image URL or Storage ID"
                        className="flex-1 h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all" 
                      />
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadImage}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          disabled={isUploading}
                        />
                        <button
                          type="button"
                          className="h-11 px-4 rounded-xl border border-input bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                          disabled={isUploading}
                        >
                          {isUploading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <ImageIcon className="size-4 text-foreground" />}
                        </button>
                      </div>
                    </div>
                  </label>
                </div>

                <label className="grid gap-1.5 text-sm font-medium">
                  Insider Tip
                  <textarea value={spotForm.tip} onChange={(e) => setSpotForm({ ...spotForm, tip: e.target.value })} required rows={3} className="rounded-xl border border-input bg-background p-3 focus:ring-2 ring-accent/50 outline-none transition-all resize-none" />
                </label>
              </form>
            </div>
            <div className="p-6 border-t border-border bg-secondary/20 flex justify-end gap-3 rounded-b-3xl">
              <button onClick={() => setIsSpotModalOpen(false)} className="px-5 py-2.5 rounded-full font-medium hover:bg-secondary transition-colors">Cancel</button>
              <button form="spot-form" type="submit" disabled={pending} className="px-5 py-2.5 rounded-full bg-foreground text-background font-medium hover:bg-foreground/90 transition-transform active:scale-95 disabled:opacity-50">
                {pending ? "Saving..." : spotForm.spotId ? "Update Spot" : "Create Spot"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Destination Modal */}
      {isDestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">{destForm.destinationId ? "Edit Destination" : "Add New Destination"}</h2>
              <button onClick={() => setIsDestModalOpen(false)} className="text-muted-foreground hover:text-foreground p-2 -m-2">Close</button>
            </div>
            <div className="overflow-y-auto p-6">
              <form id="dest-form" onSubmit={submitDestForm} className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-medium">
                    City
                    <input value={destForm.city} onChange={(e) => setDestForm({ ...destForm, city: e.target.value })} required className="h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Slug
                    <input value={destForm.slug} onChange={(e) => setDestForm({ ...destForm, slug: e.target.value })} placeholder="Auto-generated" className="h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all" />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-medium">
                    Country
                    <input value={destForm.country} onChange={(e) => setDestForm({ ...destForm, country: e.target.value })} required className="h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Flag (Emoji)
                    <input value={destForm.flag} onChange={(e) => setDestForm({ ...destForm, flag: e.target.value })} required className="h-11 rounded-xl border border-input bg-background px-3 focus:ring-2 ring-accent/50 outline-none transition-all" />
                  </label>
                </div>

                <div className="grid gap-1.5 text-sm font-medium">
                  Destination Center & Zoom
                  <div className="overflow-hidden rounded-xl border border-input">
                    <AdminMapPicker
                      center={destForm.mapCenterLng ? [Number(destForm.mapCenterLng), Number(destForm.mapCenterLat)] : [0, 0]}
                      zoom={destForm.mapZoom ? Number(destForm.mapZoom) : 2}
                      markerLngLat={null}
                      onCenterChange={(lng, lat) => setDestForm(current => ({ ...current, mapCenterLng: String(lng), mapCenterLat: String(lat), youLngLatLng: String(lng), youLngLatLat: String(lat) }))}
                      onZoomChange={(zoom) => setDestForm(current => ({ ...current, mapZoom: String(zoom) }))}
                    />
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span>Lng: {destForm.mapCenterLng || "Not set"}</span>
                    <span>Lat: {destForm.mapCenterLat || "Not set"}</span>
                    <span>Zoom: {destForm.mapZoom ? Number(destForm.mapZoom).toFixed(1) : "Not set"}</span>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-border bg-secondary/20 flex justify-end gap-3 rounded-b-3xl">
              <button onClick={() => setIsDestModalOpen(false)} className="px-5 py-2.5 rounded-full font-medium hover:bg-secondary transition-colors">Cancel</button>
              <button form="dest-form" type="submit" disabled={pending} className="px-5 py-2.5 rounded-full bg-foreground text-background font-medium hover:bg-foreground/90 transition-transform active:scale-95 disabled:opacity-50">
                {pending ? "Saving..." : destForm.destinationId ? "Update Destination" : "Create Destination"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
