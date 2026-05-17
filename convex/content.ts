import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./authz";

const categoryValidator = v.union(v.literal("eat"), v.literal("see"), v.literal("gems"), v.literal("routes"));
const lngLatValidator = v.array(v.number());
const placeholderImage = "/placeholder.svg";
const poiStatusValidator = v.union(v.literal("draft"), v.literal("active"), v.literal("archived"));
const customValueValidator = v.union(v.string(), v.number(), v.boolean(), v.null());
const poiFieldValidator = v.object({
  key: v.string(),
  label: v.string(),
  kind: v.union(v.literal("text"), v.literal("textarea"), v.literal("select"), v.literal("number"), v.literal("url")),
  required: v.boolean(),
  showOnCard: v.boolean(),
  showOnDetail: v.boolean(),
  options: v.optional(v.array(v.string())),
});
const poiTypeInputValidator = {
  slug: v.string(),
  label: v.string(),
  pluralLabel: v.string(),
  icon: v.string(),
  description: v.optional(v.string()),
  isBookable: v.boolean(),
  fields: v.array(poiFieldValidator),
};
const poiInputValidator = {
  typeId: v.id("poiTypes"),
  slug: v.string(),
  name: v.string(),
  city: v.string(),
  country: v.string(),
  summary: v.string(),
  detail: v.string(),
  tag: v.string(),
  tags: v.array(v.string()),
  image: v.string(),
  gallery: v.optional(v.array(v.string())),
  lngLat: lngLatValidator,
  walkMin: v.number(),
  driveMin: v.number(),
  customFields: v.record(v.string(), customValueValidator),
  status: poiStatusValidator,
};
const featuredPlanInputValidator = {
  slug: v.string(),
  title: v.string(),
  summary: v.string(),
  image: v.string(),
  countries: v.array(v.string()),
  durationLabel: v.string(),
  status: poiStatusValidator,
};

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

function normalizeTags(tags: string[]) {
  return tags.map((tag) => normalizeText(tag)).filter(Boolean).slice(0, 12);
}

async function resolveImageUrl(ctx: QueryCtx | MutationCtx, image: string) {
  if (image && !image.startsWith("/") && !image.startsWith("http")) {
    try {
      const url = await ctx.storage.getUrl(image);
      if (url) return url;
    } catch {
      // Keep the stored value if it is not a storage id.
    }
  }

  return image || placeholderImage;
}

async function getPoiPayload(ctx: QueryCtx | MutationCtx, poi: Doc<"pointsOfInterest">) {
  const type = await ctx.db.get(poi.typeId);
  if (!type || type.status !== "active") {
    return null;
  }

  const lngLat = requireLngLat(poi.lngLat);
  return {
    _id: poi._id,
    id: poi.slug,
    slug: poi.slug,
    name: poi.name,
    category: type.slug,
    typeId: poi.typeId,
    typeLabel: type.label,
    typePluralLabel: type.pluralLabel,
    typeIcon: type.icon,
    isBookable: type.isBookable,
    city: poi.city,
    country: poi.country,
    destinationCity: poi.city,
    destinationCountry: poi.country,
    destinationId: `${poi.country}-${poi.city}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    top: "50%",
    left: "50%",
    lngLat,
    walkMin: poi.walkMin,
    driveMin: poi.driveMin,
    tip: poi.summary,
    summary: poi.summary,
    detail: poi.detail,
    tag: poi.tag,
    tags: poi.tags,
    image: await resolveImageUrl(ctx, poi.image),
    gallery: await Promise.all((poi.gallery ?? []).map((image) => resolveImageUrl(ctx, image))),
    customFields: poi.customFields,
    typeFields: type.fields,
    status: poi.status,
    archivedAt: poi.archivedAt ?? null,
  };
}

async function assertUniquePoiTypeSlug(ctx: QueryCtx | MutationCtx, slug: string, currentTypeId?: Id<"poiTypes">) {
  const existing = await ctx.db.query("poiTypes").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
  if (existing && existing._id !== currentTypeId) {
    throw new ConvexError("A Pick type with that slug already exists.");
  }
}

async function assertUniquePoiSlug(ctx: QueryCtx | MutationCtx, slug: string, currentPoiId?: Id<"pointsOfInterest">) {
  const existing = await ctx.db.query("pointsOfInterest").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
  if (existing && existing._id !== currentPoiId) {
    throw new ConvexError("A Wandr Pick with that slug already exists.");
  }
}

async function assertUniquePlanSlug(ctx: QueryCtx | MutationCtx, slug: string, currentPlanId?: Id<"featuredTravelPlans">) {
  const existing = await ctx.db.query("featuredTravelPlans").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
  if (existing && existing._id !== currentPlanId) {
    throw new ConvexError("A travel plan with that slug already exists.");
  }
}

export const listWandrPicksPublic = query({
  args: {},
  handler: async (ctx) => {
    const [types, picks, plans] = await Promise.all([
      ctx.db.query("poiTypes").withIndex("by_status", (q) => q.eq("status", "active")).take(100),
      ctx.db.query("pointsOfInterest").withIndex("by_status", (q) => q.eq("status", "active")).take(1000),
      ctx.db.query("featuredTravelPlans").withIndex("by_status", (q) => q.eq("status", "active")).take(100),
    ]);

    const resolvedPicks = (await Promise.all(picks.map((pick) => getPoiPayload(ctx, pick)))).filter((pick) => pick !== null);
    const grouped = new Map<string, { id: string; city: string; country: string; flag: string; map: { center: [number, number]; zoom: number }; you: { top: string; left: string; lngLat: [number, number] }; spots: NonNullable<Awaited<ReturnType<typeof getPoiPayload>>>[] }>();

    for (const pick of resolvedPicks) {
      const key = pick.destinationId;
      const existing = grouped.get(key);
      if (existing) {
        existing.spots.push(pick);
      } else {
        grouped.set(key, {
          id: key,
          city: pick.city,
          country: pick.country,
          flag: pick.country.slice(0, 2).toUpperCase(),
          map: { center: pick.lngLat, zoom: 12 },
          you: { top: "50%", left: "50%", lngLat: pick.lngLat },
          spots: [pick],
        });
      }
    }

    const resolvedPlans = await Promise.all(
      plans.map(async (plan) => {
        const stops = await ctx.db
          .query("featuredTravelPlanStops")
          .withIndex("by_planId_and_position", (q) => q.eq("planId", plan._id))
          .order("asc")
          .take(100);
        return {
          ...plan,
          image: await resolveImageUrl(ctx, plan.image),
          stops: stops.map((stop) => ({ poiId: stop.poiId, position: stop.position, note: stop.note ?? "" })),
        };
      }),
    );

    return {
      types,
      picks: resolvedPicks,
      destinations: Array.from(grouped.values()),
      featuredPlans: resolvedPlans,
    };
  },
});

export const getPickBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const poi = await ctx.db.query("pointsOfInterest").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    if (!poi || poi.status !== "active") {
      return null;
    }

    return await getPoiPayload(ctx, poi);
  },
});

export const adminSuite = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [types, picks, plans, requests] = await Promise.all([
      ctx.db.query("poiTypes").take(200),
      ctx.db.query("pointsOfInterest").take(1000),
      ctx.db.query("featuredTravelPlans").take(200),
      ctx.db.query("stayBookingRequests").take(500),
    ]);

    const planStops = new Map<Id<"featuredTravelPlans">, Doc<"featuredTravelPlanStops">[]>();
    for (const plan of plans) {
      planStops.set(
        plan._id,
        await ctx.db
          .query("featuredTravelPlanStops")
          .withIndex("by_planId_and_position", (q) => q.eq("planId", plan._id))
          .order("asc")
          .take(100),
      );
    }

    return {
      types,
      picks: await Promise.all(picks.map(async (pick) => ({ ...(await getPoiPayload(ctx, pick)), _id: pick._id, typeId: pick.typeId, status: pick.status }))),
      plans: plans.map((plan) => ({ ...plan, stops: planStops.get(plan._id) ?? [] })),
      requests,
    };
  },
});

export const upsertPoiType = mutation({
  args: { typeId: v.optional(v.id("poiTypes")), ...poiTypeInputValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const slug = normalizeSlug(args.slug || args.label);
    if (!slug || !normalizeText(args.label) || !normalizeText(args.pluralLabel)) {
      throw new ConvexError("Type name is required.");
    }
    await assertUniquePoiTypeSlug(ctx, slug, args.typeId);
    const input = {
      slug,
      label: normalizeText(args.label),
      pluralLabel: normalizeText(args.pluralLabel),
      icon: normalizeText(args.icon) || "map-pin",
      description: args.description ? normalizeText(args.description) : undefined,
      isBookable: args.isBookable,
      fields: args.fields.map((field) => ({
        ...field,
        key: normalizeSlug(field.key || field.label),
        label: normalizeText(field.label),
        options: field.options?.map((option) => normalizeText(option)).filter(Boolean),
      })).filter((field) => field.key && field.label),
      status: "active" as const,
      updatedAt: Date.now(),
    };

    if (args.typeId) {
      await ctx.db.patch(args.typeId, input);
      return args.typeId;
    }
    return await ctx.db.insert("poiTypes", input);
  },
});

export const archivePoiType = mutation({
  args: { typeId: v.id("poiTypes") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.typeId, { status: "archived", updatedAt: Date.now() });
  },
});

export const upsertPick = mutation({
  args: { poiId: v.optional(v.id("pointsOfInterest")), ...poiInputValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const type = await ctx.db.get(args.typeId);
    if (!type || type.status !== "active") {
      throw new ConvexError("Choose an active Pick type.");
    }
    const slug = normalizeSlug(args.slug || args.name);
    if (!slug || !normalizeText(args.name) || !normalizeText(args.summary)) {
      throw new ConvexError("Name and summary are required.");
    }
    await assertUniquePoiSlug(ctx, slug, args.poiId);
    const now = Date.now();
    const input = {
      typeId: args.typeId,
      slug,
      name: normalizeText(args.name),
      city: normalizeText(args.city),
      country: normalizeText(args.country),
      summary: normalizeText(args.summary),
      detail: normalizeText(args.detail || args.summary),
      tag: normalizeText(args.tag),
      tags: normalizeTags(args.tags),
      image: normalizeText(args.image) || placeholderImage,
      gallery: args.gallery?.map((image) => normalizeText(image)).filter(Boolean),
      lngLat: requireLngLat(args.lngLat),
      walkMin: Math.max(0, Math.round(args.walkMin)),
      driveMin: Math.max(0, Math.round(args.driveMin)),
      customFields: args.customFields,
      status: args.status,
      archivedAt: args.status === "archived" ? now : undefined,
      updatedAt: now,
    };
    if (args.poiId) {
      await ctx.db.patch(args.poiId, input);
      return args.poiId;
    }
    return await ctx.db.insert("pointsOfInterest", input);
  },
});

export const archivePick = mutation({
  args: { poiId: v.id("pointsOfInterest") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.poiId, { status: "archived", archivedAt: Date.now(), updatedAt: Date.now() });
  },
});

export const restorePick = mutation({
  args: { poiId: v.id("pointsOfInterest") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.poiId, { status: "active", archivedAt: undefined, updatedAt: Date.now() });
  },
});

export const upsertFeaturedPlan = mutation({
  args: {
    planId: v.optional(v.id("featuredTravelPlans")),
    ...featuredPlanInputValidator,
    stops: v.array(v.object({ poiId: v.id("pointsOfInterest"), note: v.optional(v.string()) })),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const slug = normalizeSlug(args.slug || args.title);
    if (!slug || !normalizeText(args.title)) {
      throw new ConvexError("Plan title is required.");
    }
    await assertUniquePlanSlug(ctx, slug, args.planId);
    const input = {
      slug,
      title: normalizeText(args.title),
      summary: normalizeText(args.summary),
      image: normalizeText(args.image) || placeholderImage,
      countries: normalizeTags(args.countries),
      durationLabel: normalizeText(args.durationLabel),
      status: args.status,
      updatedAt: Date.now(),
    };
    const planId = args.planId ?? await ctx.db.insert("featuredTravelPlans", input);
    if (args.planId) {
      await ctx.db.patch(args.planId, input);
      const existingStops = await ctx.db.query("featuredTravelPlanStops").withIndex("by_planId_and_position", (q) => q.eq("planId", planId)).take(100);
      for (const stop of existingStops) await ctx.db.delete(stop._id);
    }
    for (const [position, stop] of args.stops.entries()) {
      await ctx.db.insert("featuredTravelPlanStops", {
        planId,
        poiId: stop.poiId,
        position,
        note: stop.note ? normalizeText(stop.note) : undefined,
        updatedAt: Date.now(),
      });
    }
    return planId;
  },
});

export const createStayBookingRequest = mutation({
  args: {
    poiId: v.id("pointsOfInterest"),
    startDate: v.string(),
    endDate: v.string(),
    guests: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Sign in to request this stay.");
    }
    const poi = await ctx.db.get(args.poiId);
    const type = poi ? await ctx.db.get(poi.typeId) : null;
    if (!poi || poi.status !== "active" || !type?.isBookable) {
      throw new ConvexError("This Pick is not available for stay requests.");
    }
    return await ctx.db.insert("stayBookingRequests", {
      poiId: args.poiId,
      userId,
      startDate: normalizeText(args.startDate),
      endDate: normalizeText(args.endDate),
      guests: Math.max(1, Math.round(args.guests)),
      note: args.note ? normalizeText(args.note) : undefined,
      status: "pending",
      updatedAt: Date.now(),
    });
  },
});

export const updateBookingRequestStatus = mutation({
  args: {
    requestId: v.id("stayBookingRequests"),
    status: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("declined")),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.requestId, {
      status: args.status,
      adminNote: args.adminNote ? normalizeText(args.adminNote) : undefined,
      updatedAt: Date.now(),
    });
  },
});

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
    const wandrPicks = await ctx.db
      .query("pointsOfInterest")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1000);

    if (wandrPicks.length > 0) {
      const resolvedPicks = (await Promise.all(wandrPicks.map((pick) => getPoiPayload(ctx, pick)))).filter((pick) => pick !== null);
      const grouped = new Map<string, { id: string; city: string; country: string; flag: string; featuredSpotId?: string; map: { center: [number, number]; zoom: number }; you: { top: string; left: string; lngLat: [number, number] }; spots: NonNullable<Awaited<ReturnType<typeof getPoiPayload>>>[] }>();

      for (const pick of resolvedPicks) {
        const key = pick.destinationId;
        const existing = grouped.get(key);
        if (existing) {
          existing.spots.push(pick);
        } else {
          grouped.set(key, {
            id: key,
            city: pick.city,
            country: pick.country,
            flag: pick.country.slice(0, 2).toUpperCase(),
            featuredSpotId: pick.id,
            map: { center: pick.lngLat, zoom: 12 },
            you: { top: "50%", left: "50%", lngLat: pick.lngLat },
            spots: [pick],
          });
        }
      }

      return Array.from(grouped.values());
    }

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

