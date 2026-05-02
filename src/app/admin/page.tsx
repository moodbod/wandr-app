"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Archive, ArrowLeft, Check, Loader2, Pencil, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AuthDialog } from "@/components/AuthDialog";

type Category = "eat" | "see" | "gems" | "routes";
type SpotStatus = "active" | "archived";

type AdminDestination = {
  _id: Id<"destinations">;
  id?: string;
  city?: string;
  country?: string;
  flag?: string;
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

const blankForm = {
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
  const seedDefaults = useMutation(api.content.seedNamibiaDefaults);
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedDestinationId, setSelectedDestinationId] = useState<Id<"destinations"> | "">("");
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(blankForm);
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
      setForm((current) => ({ ...current, destinationId: destinations[0]._id }));
    }
  }, [destinations, selectedDestinationId]);

  const visibleSpots = useMemo(() => {
    if (!selectedDestination) {
      return [];
    }

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

  const resetForm = (destinationId = selectedDestination?._id ?? "") => {
    setForm({ ...blankForm, destinationId });
    setError(null);
    setMessage(null);
  };

  const editSpot = (spot: AdminSpot) => {
    setForm({
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
    setError(null);
    setMessage(null);
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        destinationId: form.destinationId as Id<"destinations">,
        slug: slugify(form.slug || form.name),
        name: form.name,
        category: form.category,
        top: form.top,
        left: form.left,
        lngLat: [Number(form.longitude), Number(form.latitude)],
        walkMin: Number(form.walkMin),
        driveMin: Number(form.driveMin),
        tip: form.tip,
        tag: form.tag,
        image: form.image,
      };

      if (form.spotId) {
        await updateSpot({ spotId: form.spotId, ...payload });
        setMessage("Spot updated.");
      } else {
        await createSpot(payload);
        setMessage("Spot added.");
      }

      resetForm(payload.destinationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this spot.");
    } finally {
      setPending(false);
    }
  };

  const runSeed = async () => {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const result = await seedDefaults({});
      const changedCount = result.insertedDestinations + result.insertedSpots + result.updatedImages;

      if (changedCount === 0) {
        setMessage("Seed data is already up to date.");
      } else {
        setMessage(
          `Seeded ${result.insertedDestinations} destinations, ${result.insertedSpots} spots, and updated ${result.updatedImages} images.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not seed default content.");
    } finally {
      setPending(false);
    }
  };

  const setSpotArchived = async (spotId: Id<"spots">, archived: boolean) => {
    setError(null);
    setMessage(null);

    try {
      if (archived) {
        await archiveSpot({ spotId });
        setMessage("Spot archived.");
      } else {
        await restoreSpot({ spotId });
        setMessage("Spot restored.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update archive status.");
    }
  };

  if (isLoading || (isAuthenticated && currentUser === undefined)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background text-foreground">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <section className="w-full max-w-sm rounded-lg border border-border bg-card p-5 text-center shadow-sm">
          <ShieldCheck className="mx-auto size-8 text-accent" />
          <h1 className="mt-3 text-xl font-semibold">Admin access</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in with an admin account to manage Wandr content.</p>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-foreground px-4 text-sm font-semibold text-background"
          >
            Sign in
          </button>
        </section>
        <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onSubmitted={() => setAuthOpen(false)} />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <section className="w-full max-w-sm rounded-lg border border-border bg-card p-5 text-center shadow-sm">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 text-xl font-semibold">Unauthorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your account is a traveler account. Admin role must be patched in Convex.</p>
          <Link href="/" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-foreground px-4 text-sm font-semibold text-background">
            Back to Wandr
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="grid size-10 place-items-center rounded-full bg-card shadow-sm" aria-label="Back to settings">
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                <ShieldCheck className="size-3.5" />
                Admin
              </div>
              <h1 className="text-2xl font-black leading-tight">Platform spots</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowArchived((current) => !current)}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-card px-4 text-sm font-semibold shadow-sm"
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </button>
            <button
              type="button"
              onClick={() => void runSeed()}
              disabled={pending}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
            >
              <Plus className="size-4" />
              Seed Namibia
            </button>
          </div>
        </header>

        {message ? <div className="rounded-lg bg-highlight/10 px-4 py-3 text-sm font-medium text-highlight">{message}</div> : null}
        {error ? <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</div> : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_25rem]">
          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {destinations.length === 0 ? (
                <div className="text-sm text-muted-foreground">No destinations yet. Seed the default catalog to start.</div>
              ) : (
                destinations.map((destination) => (
                  <button
                    key={destination._id}
                    type="button"
                    onClick={() => {
                      setSelectedDestinationId(destination._id);
                      setForm((current) => ({ ...current, destinationId: destination._id }));
                    }}
                    className={[
                      "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-sm",
                      selectedDestination?._id === destination._id ? "bg-foreground text-background" : "bg-card",
                    ].join(" ")}
                  >
                    <span aria-hidden>{destination.flag}</span>
                    {destination.city ?? "Destination"}
                  </button>
                ))
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              {groupedSpots.map((group) => (
                <div key={group.id} className="border-b border-border last:border-b-0">
                  <div className="flex items-center justify-between bg-secondary/60 px-4 py-3">
                    <h2 className="text-sm font-semibold">{group.label}</h2>
                    <span className="text-xs text-muted-foreground">{group.spots.length}</span>
                  </div>
                  {group.spots.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-muted-foreground">No {group.label.toLowerCase()} spots.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {group.spots.map((spot) => {
                        const archived = (spot.status ?? "active") === "archived";

                        return (
                          <div key={spot._id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div className={archived ? "opacity-60" : ""}>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">{spot.name}</h3>
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{spot.slug}</span>
                                {archived ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Archived</span> : null}
                              </div>
                              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{spot.tip}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => editSpot(spot)}
                                className="grid size-9 place-items-center rounded-full bg-secondary text-foreground"
                                aria-label={`Edit ${spot.name}`}
                              >
                                <Pencil className="size-4" />
                              </button>
                              {archived ? (
                                <button
                                  type="button"
                                  onClick={() => void setSpotArchived(spot._id, false)}
                                  className="grid size-9 place-items-center rounded-full bg-highlight/10 text-highlight"
                                  aria-label={`Restore ${spot.name}`}
                                >
                                  <RotateCcw className="size-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void setSpotArchived(spot._id, true)}
                                  className="grid size-9 place-items-center rounded-full bg-destructive/10 text-destructive"
                                  aria-label={`Archive ${spot.name}`}
                                >
                                  <Archive className="size-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={submitForm} className="h-fit rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{form.spotId ? "Edit spot" : "Add spot"}</h2>
              {form.spotId ? (
                <button type="button" onClick={() => resetForm()} className="text-sm font-medium text-muted-foreground">
                  New
                </button>
              ) : null}
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                Destination
                <select
                  value={form.destinationId}
                  onChange={(event) => setForm((current) => ({ ...current, destinationId: event.target.value as Id<"destinations"> }))}
                  required
                  className="min-h-11 rounded-lg border border-input bg-background px-3"
                >
                  <option value="">Choose destination</option>
                  {destinations.map((destination) => (
                    <option key={destination._id} value={destination._id}>
                      {destination.city}, {destination.country}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Name
                  <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required className="min-h-11 rounded-lg border border-input bg-background px-3" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Slug
                  <input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="auto-from-name" className="min-h-11 rounded-lg border border-input bg-background px-3" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-sm font-medium">
                  Category
                  <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as Category }))} className="min-h-11 rounded-lg border border-input bg-background px-3">
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Walk min
                  <input value={form.walkMin} onChange={(event) => setForm((current) => ({ ...current, walkMin: event.target.value }))} type="number" min="0" required className="min-h-11 rounded-lg border border-input bg-background px-3" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Drive min
                  <input value={form.driveMin} onChange={(event) => setForm((current) => ({ ...current, driveMin: event.target.value }))} type="number" min="0" required className="min-h-11 rounded-lg border border-input bg-background px-3" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Longitude
                  <input value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} type="number" step="any" required className="min-h-11 rounded-lg border border-input bg-background px-3" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Latitude
                  <input value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} type="number" step="any" required className="min-h-11 rounded-lg border border-input bg-background px-3" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Map top
                  <input value={form.top} onChange={(event) => setForm((current) => ({ ...current, top: event.target.value }))} required className="min-h-11 rounded-lg border border-input bg-background px-3" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Map left
                  <input value={form.left} onChange={(event) => setForm((current) => ({ ...current, left: event.target.value }))} required className="min-h-11 rounded-lg border border-input bg-background px-3" />
                </label>
              </div>

              <label className="grid gap-1.5 text-sm font-medium">
                Tag
                <input value={form.tag} onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value }))} required className="min-h-11 rounded-lg border border-input bg-background px-3" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Image URL
                <input value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} className="min-h-11 rounded-lg border border-input bg-background px-3" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Tip
                <textarea value={form.tip} onChange={(event) => setForm((current) => ({ ...current, tip: event.target.value }))} required rows={4} className="rounded-lg border border-input bg-background px-3 py-2" />
              </label>

              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {form.spotId ? "Save changes" : "Add spot"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
