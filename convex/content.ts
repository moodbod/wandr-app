import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./authz";

const categoryValidator = v.union(v.literal("eat"), v.literal("see"), v.literal("gems"), v.literal("routes"));
const lngLatValidator = v.array(v.number());
const placeholderImage = "/placeholder.svg";

const spotInputValidator = {
  destinationId: v.id("destinations"),
  slug: v.string(),
  name: v.string(),
  category: categoryValidator,
  top: v.string(),
  left: v.string(),
  lngLat: lngLatValidator,
  walkMin: v.number(),
  driveMin: v.number(),
  tip: v.string(),
  tag: v.string(),
  image: v.string(),
};

type SpotInput = {
  destinationId: Id<"destinations">;
  slug: string;
  name: string;
  category: "eat" | "see" | "gems" | "routes";
  top: string;
  left: string;
  lngLat: number[];
  walkMin: number;
  driveMin: number;
  tip: string;
  tag: string;
  image: string;
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeText(value: string) {
  return value.trim();
}

function requireLngLat(value: number[]) {
  if (value.length !== 2 || value.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new ConvexError("Coordinates must include longitude and latitude.");
  }

  return [value[0], value[1]] as [number, number];
}

function getDestinationPayload(destination: Doc<"destinations">) {
  if (!destination.slug || !destination.map || !destination.you.lngLat) {
    return null;
  }

  const center = requireLngLat(destination.map.center);
  const youLngLat = requireLngLat(destination.you.lngLat);

  return {
    _id: destination._id,
    id: destination.slug,
    city: destination.city,
    country: destination.country,
    flag: destination.flag,
    featuredSpotId: destination.featuredSpotId,
    map: { center, zoom: destination.map.zoom },
    you: {
      top: destination.you.top,
      left: destination.you.left,
      lngLat: youLngLat,
    },
  };
}

async function getSpotPayload(ctx: QueryCtx | MutationCtx, spot: Doc<"spots">) {
  if (!spot.lngLat) {
    return null;
  }

  const lngLat = requireLngLat(spot.lngLat);
  let imageUrl = spot.image;

  // Resolve storage ID to URL if it's not a direct URL/path
  if (imageUrl && !imageUrl.startsWith("/") && !imageUrl.startsWith("http")) {
    try {
      const url = await ctx.storage.getUrl(imageUrl);
      if (url) {
        imageUrl = url;
      }
    } catch (e) {
      // Not a storage ID, keep as is
    }
  }

  return {
    _id: spot._id,
    id: spot.slug,
    name: spot.name,
    category: spot.category,
    top: spot.top,
    left: spot.left,
    lngLat,
    walkMin: spot.walkMin,
    driveMin: spot.driveMin,
    tip: spot.tip,
    tag: spot.tag,
    image: imageUrl,
    status: spot.status ?? "active",
    archivedAt: spot.archivedAt ?? null,
  };
}

async function requireActiveDestination(ctx: QueryCtx | MutationCtx, destinationId: Id<"destinations">) {
  const destination = await ctx.db.get(destinationId);

  if (!destination || (destination.status ?? "active") !== "active") {
    throw new ConvexError("Destination not found.");
  }

  return destination;
}

async function assertUniqueSpotSlug(ctx: QueryCtx | MutationCtx, slug: string, currentSpotId?: Id<"spots">) {
  const existing = await ctx.db
    .query("spots")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();

  if (existing && existing._id !== currentSpotId) {
    throw new ConvexError("A spot or route with that slug already exists.");
  }
}

function normalizeSpotInput(args: SpotInput) {
  const slug = normalizeSlug(args.slug);
  const name = normalizeText(args.name);
  const tip = normalizeText(args.tip);
  const tag = normalizeText(args.tag);
  const image = normalizeText(args.image);

  if (!slug || !name || !tip || !tag) {
    throw new ConvexError("Slug, name, tag, and tip are required.");
  }

  if (args.walkMin < 0 || args.driveMin < 0) {
    throw new ConvexError("Travel times must be zero or more.");
  }

  return {
    destinationId: args.destinationId,
    slug,
    name,
    category: args.category,
    top: normalizeText(args.top) || "50%",
    left: normalizeText(args.left) || "50%",
    lngLat: requireLngLat(args.lngLat),
    walkMin: Math.round(args.walkMin),
    driveMin: Math.round(args.driveMin),
    tip,
    tag,
    image: image || placeholderImage,
  };
}

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const [destinations, allSpots] = await Promise.all([
      ctx.db
        .query("destinations")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(100),
      ctx.db
        .query("spots")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(1000),
    ]);

    // Group spots by destinationId in memory instead of N+1 queries
    const spotsByDestination = new Map<Id<"destinations">, Doc<"spots">[]>();
    for (const spot of allSpots) {
      let group = spotsByDestination.get(spot.destinationId);
      if (!group) {
        group = [];
        spotsByDestination.set(spot.destinationId, group);
      }
      group.push(spot);
    }

    return Promise.all(
      destinations.map(async (destination) => {
        const destinationPayload = getDestinationPayload(destination);
        if (!destinationPayload) {
          return null;
        }

        const spots = spotsByDestination.get(destination._id) ?? [];
        const resolvedSpots = await Promise.all(spots.map((s) => getSpotPayload(ctx, s)));
        return {
          ...destinationPayload,
          spots: resolvedSpots.filter((spot) => spot !== null),
        };
      })
    ).then((results) => results.filter((destination) => destination !== null));
  },
});

export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const destinations = await ctx.db.query("destinations").take(100);
    const spots = await ctx.db.query("spots").take(500);

    const resolvedSpots = await Promise.all(
      spots.map(async (spot) => ({
        ...(await getSpotPayload(ctx, spot)),
        _id: spot._id,
        destinationId: spot.destinationId,
        slug: spot.slug,
        status: spot.status ?? "active",
        archivedAt: spot.archivedAt ?? null,
      }))
    );

    return {
      destinations: destinations.map((destination) => ({
        ...getDestinationPayload(destination),
        _id: destination._id,
        status: destination.status ?? "active",
        archivedAt: destination.archivedAt ?? null,
      })),
      spots: resolvedSpots,
    };
  },
});

export const createSpot = mutation({
  args: spotInputValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await requireActiveDestination(ctx, args.destinationId);
    const input = normalizeSpotInput(args);
    await assertUniqueSpotSlug(ctx, input.slug);
    const now = Date.now();

    return await ctx.db.insert("spots", {
      ...input,
      status: "active",
      updatedAt: now,
    });
  },
});

export const updateSpot = mutation({
  args: {
    spotId: v.id("spots"),
    ...spotInputValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.spotId);

    if (!existing) {
      throw new ConvexError("Spot not found.");
    }

    await requireActiveDestination(ctx, args.destinationId);
    const input = normalizeSpotInput(args);
    await assertUniqueSpotSlug(ctx, input.slug, args.spotId);

    await ctx.db.patch(args.spotId, {
      ...input,
      updatedAt: Date.now(),
    });
  },
});

export const archiveSpot = mutation({
  args: { spotId: v.id("spots") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const spot = await ctx.db.get(args.spotId);

    if (!spot) {
      throw new ConvexError("Spot not found.");
    }

    const now = Date.now();
    await ctx.db.patch(args.spotId, { status: "archived", archivedAt: now, updatedAt: now });
  },
});

export const restoreSpot = mutation({
  args: { spotId: v.id("spots") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const spot = await ctx.db.get(args.spotId);

    if (!spot) {
      throw new ConvexError("Spot not found.");
    }

    await ctx.db.patch(args.spotId, { status: "active", archivedAt: undefined, updatedAt: Date.now() });
  },
});

export const createDestination = mutation({
  args: {
    slug: v.string(),
    city: v.string(),
    country: v.string(),
    flag: v.string(),
    mapTop: v.string(),
    mapLeft: v.string(),
    mapCenter: v.array(v.number()),
    mapZoom: v.number(),
    youTop: v.string(),
    youLeft: v.string(),
    youLngLat: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const existing = await ctx.db
      .query("destinations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      throw new ConvexError("A destination with that slug already exists.");
    }

    return await ctx.db.insert("destinations", {
      slug: args.slug,
      city: args.city,
      country: args.country,
      flag: args.flag,
      map: {
        center: args.mapCenter,
        zoom: args.mapZoom,
      },
      you: {
        top: args.youTop,
        left: args.youLeft,
        lngLat: args.youLngLat,
      },
      status: "active",
      updatedAt: Date.now(),
    });
  },
});

export const updateDestination = mutation({
  args: {
    destinationId: v.id("destinations"),
    slug: v.string(),
    city: v.string(),
    country: v.string(),
    flag: v.string(),
    mapTop: v.string(),
    mapLeft: v.string(),
    mapCenter: v.array(v.number()),
    mapZoom: v.number(),
    youTop: v.string(),
    youLeft: v.string(),
    youLngLat: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const existing = await ctx.db.get(args.destinationId);
    if (!existing) {
      throw new ConvexError("Destination not found.");
    }

    const duplicate = await ctx.db
      .query("destinations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (duplicate && duplicate._id !== args.destinationId) {
      throw new ConvexError("A destination with that slug already exists.");
    }

    await ctx.db.patch(args.destinationId, {
      slug: args.slug,
      city: args.city,
      country: args.country,
      flag: args.flag,
      map: {
        center: args.mapCenter,
        zoom: args.mapZoom,
      },
      you: {
        top: args.youTop,
        left: args.youLeft,
        lngLat: args.youLngLat,
      },
      updatedAt: Date.now(),
    });
  },
});

export const archiveDestination = mutation({
  args: { destinationId: v.id("destinations") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const destination = await ctx.db.get(args.destinationId);

    if (!destination) {
      throw new ConvexError("Destination not found.");
    }

    const now = Date.now();
    await ctx.db.patch(args.destinationId, { status: "archived", archivedAt: now, updatedAt: now });
  },
});

export const deleteDestination = mutation({
  args: { destinationId: v.id("destinations") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const destination = await ctx.db.get(args.destinationId);
    if (!destination) throw new ConvexError("Destination not found.");

    // Delete all spots for this destination
    const spots = await ctx.db
      .query("spots")
      .withIndex("by_destination", (q) => q.eq("destinationId", args.destinationId))
      .collect();
    
    for (const spot of spots) {
      await ctx.db.delete(spot._id);
    }

    await ctx.db.delete(args.destinationId);
  },
});

export const deleteSpot = mutation({
  args: { spotId: v.id("spots") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.spotId);
  },
});

export const resetDatabase = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const destinations = await ctx.db.query("destinations").collect();
    const spots = await ctx.db.query("spots").collect();
    const trips = await ctx.db.query("trips").collect();
    const stops = await ctx.db.query("tripStops").collect();

    for (const d of destinations) await ctx.db.delete(d._id);
    for (const s of spots) await ctx.db.delete(s._id);
    for (const t of trips) await ctx.db.delete(t._id);
    for (const st of stops) await ctx.db.delete(st._id);
  },
});

export const restoreDestination = mutation({
  args: { destinationId: v.id("destinations") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const destination = await ctx.db.get(args.destinationId);

    if (!destination) {
      throw new ConvexError("Destination not found.");
    }

    await ctx.db.patch(args.destinationId, { status: "active", archivedAt: undefined, updatedAt: Date.now() });
  },
});

export const setFeaturedSpot = mutation({
  args: {
    destinationId: v.id("destinations"),
    spotId: v.id("spots"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const destination = await ctx.db.get(args.destinationId);
    if (!destination) {
      throw new ConvexError("Destination not found.");
    }

    const spot = await ctx.db.get(args.spotId);
    if (!spot || spot.destinationId !== args.destinationId) {
      throw new ConvexError("Spot not found or does not belong to destination.");
    }

    await ctx.db.patch(args.destinationId, {
      featuredSpotId: args.spotId,
      updatedAt: Date.now(),
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

