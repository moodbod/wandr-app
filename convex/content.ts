import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./authz";
import { defaultDestinations, seedImageBySlug } from "./seedData";

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
    map: { center, zoom: destination.map.zoom },
    you: {
      top: destination.you.top,
      left: destination.you.left,
      lngLat: youLngLat,
    },
  };
}

function getSpotPayload(spot: Doc<"spots">) {
  if (!spot.lngLat) {
    return null;
  }

  const lngLat = requireLngLat(spot.lngLat);

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
    image: spot.image,
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
    const destinations = await ctx.db
      .query("destinations")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(100);

    const payload = await Promise.all(
      destinations.map(async (destination) => {
        const destinationPayload = getDestinationPayload(destination);

        if (!destinationPayload) {
          return null;
        }

        const spots = await ctx.db
          .query("spots")
          .withIndex("by_destinationId_and_status", (q) => q.eq("destinationId", destination._id).eq("status", "active"))
          .take(200);

        return {
          ...destinationPayload,
          spots: spots.map(getSpotPayload).filter((spot) => spot !== null),
        };
      }),
    );

    return payload.filter((destination) => destination !== null);
  },
});

export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const destinations = await ctx.db.query("destinations").take(100);
    const spots = await ctx.db.query("spots").take(500);

    return {
      destinations: destinations.map((destination) => ({
        ...getDestinationPayload(destination),
        _id: destination._id,
        status: destination.status ?? "active",
        archivedAt: destination.archivedAt ?? null,
      })),
      spots: spots.map((spot) => ({
        ...getSpotPayload(spot),
        _id: spot._id,
        destinationId: spot.destinationId,
        slug: spot.slug,
        status: spot.status ?? "active",
        archivedAt: spot.archivedAt ?? null,
      })),
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

export const seedNamibiaDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    let insertedDestinations = 0;
    let insertedSpots = 0;
    let updatedSpots = 0;
    const now = Date.now();

    for (const destination of defaultDestinations) {
      let destinationDoc = await ctx.db
        .query("destinations")
        .withIndex("by_slug", (q) => q.eq("slug", destination.slug))
        .first();

      if (!destinationDoc) {
        const destinationId = await ctx.db.insert("destinations", {
          slug: destination.slug,
          city: destination.city,
          country: destination.country,
          flag: destination.flag,
          map: { center: [...destination.map.center], zoom: destination.map.zoom },
          you: { top: destination.you.top, left: destination.you.left, lngLat: [...destination.you.lngLat] },
          status: "active",
          updatedAt: now,
        });
        destinationDoc = await ctx.db.get(destinationId);
        insertedDestinations += 1;
      }

      if (!destinationDoc) {
        throw new ConvexError("Could not seed destination.");
      }

      for (const spot of destination.spots) {
        const existingSpot = await ctx.db
          .query("spots")
          .withIndex("by_slug", (q) => q.eq("slug", spot.slug))
          .first();

        if (existingSpot) {
          const seedImage = seedImageBySlug[spot.slug] ?? placeholderImage;
          const patch: Partial<Doc<"spots">> = {};

          if (existingSpot.destinationId !== destinationDoc._id) {
            patch.destinationId = destinationDoc._id;
          }
          if (existingSpot.name !== spot.name) {
            patch.name = spot.name;
          }
          if (existingSpot.category !== spot.category) {
            patch.category = spot.category;
          }
          if (existingSpot.top !== spot.top) {
            patch.top = spot.top;
          }
          if (existingSpot.left !== spot.left) {
            patch.left = spot.left;
          }
          if (JSON.stringify(existingSpot.lngLat ?? []) !== JSON.stringify(spot.lngLat)) {
            patch.lngLat = [...spot.lngLat];
          }
          if (existingSpot.walkMin !== spot.walkMin) {
            patch.walkMin = spot.walkMin;
          }
          if (existingSpot.driveMin !== spot.driveMin) {
            patch.driveMin = spot.driveMin;
          }
          if (existingSpot.tip !== spot.tip) {
            patch.tip = spot.tip;
          }
          if (existingSpot.tag !== spot.tag) {
            patch.tag = spot.tag;
          }
          if (!existingSpot.image || existingSpot.image === placeholderImage) {
            patch.image = seedImage;
          }

          if (Object.keys(patch).length > 0) {
            await ctx.db.patch(existingSpot._id, { ...patch, updatedAt: now });
            updatedSpots += 1;
          }

          continue;
        }

        await ctx.db.insert("spots", {
          destinationId: destinationDoc._id,
          ...spot,
          lngLat: [...spot.lngLat],
          image: seedImageBySlug[spot.slug] ?? placeholderImage,
          status: "active",
          updatedAt: now,
        });
        insertedSpots += 1;
      }
    }

    return { insertedDestinations, insertedSpots, updatedSpots };
  },
});
