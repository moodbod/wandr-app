import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const routeMode = v.union(v.literal("walk"), v.literal("drive"));
const exploreDestinationId = "namibia";
const offlineAction = v.union(
  v.object({
    type: v.literal("markDone"),
    tripStopId: v.id("tripStops"),
  }),
  v.object({
    type: v.literal("skip"),
    tripStopId: v.id("tripStops"),
  }),
  v.object({
    type: v.literal("setRouteMode"),
    routeMode,
  }),
  v.object({
    type: v.literal("moveStop"),
    tripStopId: v.id("tripStops"),
    direction: v.union(v.literal("up"), v.literal("down")),
  }),
);

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new ConvexError("You must be signed in to plan a trip.");
  }

  return userId;
}

async function getOpenTrip(ctx: QueryCtx | MutationCtx, userId: Id<"users">, destinationId: string) {
  const activeTrip = await ctx.db
    .query("trips")
    .withIndex("by_userId_and_destinationId_and_status", (q) =>
      q.eq("userId", userId).eq("destinationId", destinationId).eq("status", "active"),
    )
    .first();

  if (activeTrip) {
    return activeTrip;
  }

  return await ctx.db
    .query("trips")
    .withIndex("by_userId_and_destinationId_and_status", (q) =>
      q.eq("userId", userId).eq("destinationId", destinationId).eq("status", "planning"),
    )
    .first();
}

async function getLatestOpenTripByStatus(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  status: "planning" | "active",
) {
  return await ctx.db
    .query("trips")
    .withIndex("by_userId_and_status_and_updatedAt", (q) => q.eq("userId", userId).eq("status", status))
    .order("desc")
    .first();
}

async function getOpenExploreTrip(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const exploreTrip = await getOpenTrip(ctx, userId, exploreDestinationId);

  if (exploreTrip) {
    return exploreTrip;
  }

  return (await getLatestOpenTripByStatus(ctx, userId, "active")) ?? (await getLatestOpenTripByStatus(ctx, userId, "planning"));
}

async function getTripStops(ctx: QueryCtx | MutationCtx, tripId: Id<"trips">) {
  return await ctx.db
    .query("tripStops")
    .withIndex("by_tripId_and_position", (q) => q.eq("tripId", tripId))
    .order("asc")
    .collect();
}

async function getTripPayload(ctx: QueryCtx | MutationCtx, trip: Doc<"trips">) {
  const stops = await getTripStops(ctx, trip._id);
  return { trip, stops };
}

async function requireOwnedTrip(ctx: MutationCtx, tripId: Id<"trips">, allowedStatuses?: Doc<"trips">["status"][]) {
  const userId = await requireUserId(ctx);
  const trip = await ctx.db.get(tripId);

  if (!trip || trip.userId !== userId) {
    throw new ConvexError("Trip not found.");
  }

  if (allowedStatuses && !allowedStatuses.includes(trip.status)) {
    throw new ConvexError("That trip cannot be changed in its current state.");
  }

  return trip;
}

async function requireOwnedStop(ctx: MutationCtx, tripStopId: Id<"tripStops">, allowedStatuses?: Doc<"trips">["status"][]) {
  const stop = await ctx.db.get(tripStopId);

  if (!stop) {
    throw new ConvexError("Trip stop not found.");
  }

  const trip = await requireOwnedTrip(ctx, stop.tripId, allowedStatuses);
  return { trip, stop };
}

async function touchTrip(ctx: MutationCtx, tripId: Id<"trips">) {
  await ctx.db.patch(tripId, { updatedAt: Date.now() });
}

export const getActiveForDestination = query({
  args: { destinationId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return null;
    }

    const trip = await getOpenTrip(ctx, userId, args.destinationId);

    if (!trip) {
      return null;
    }

    return await getTripPayload(ctx, trip);
  },
});

export const getActiveForExplore = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return null;
    }

    const trip = await getOpenExploreTrip(ctx, userId);

    if (!trip) {
      return null;
    }

    return await getTripPayload(ctx, trip);
  },
});

export const resumeActive = query({
  args: { preferredTripId: v.optional(v.id("trips")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return null;
    }

    if (args.preferredTripId) {
      const preferredTrip = await ctx.db.get(args.preferredTripId);

      if (preferredTrip && preferredTrip.userId === userId && preferredTrip.status === "active") {
        return await getTripPayload(ctx, preferredTrip);
      }
    }

    const trip = await ctx.db
      .query("trips")
      .withIndex("by_userId_and_status_and_updatedAt", (q) => q.eq("userId", userId).eq("status", "active"))
      .order("desc")
      .first();

    if (!trip) {
      return null;
    }

    return await getTripPayload(ctx, trip);
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return [];
    }

    const trips = await ctx.db
      .query("trips")
      .withIndex("by_userId_and_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(25);

    return await Promise.all(
      trips.map(async (trip) => ({
        trip,
        stops: await getTripStops(ctx, trip._id),
      })),
    );
  },
});

export const addStop = mutation({
  args: {
    destinationId: v.string(),
    spotId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    let trip = await getOpenExploreTrip(ctx, userId);

    if (trip?.status === "active") {
      throw new ConvexError("Finish this adventure before changing the stop list.");
    }

    if (!trip) {
      const tripId = await ctx.db.insert("trips", {
        userId,
        destinationId: exploreDestinationId,
        title: "Your adventure",
        status: "planning",
        routeMode: "walk",
        updatedAt: now,
      });
      trip = await ctx.db.get(tripId);
    }

    if (!trip) {
      throw new ConvexError("Could not create trip.");
    }

    const duplicate = await ctx.db
      .query("tripStops")
      .withIndex("by_tripId_and_spotId", (q) => q.eq("tripId", trip._id).eq("spotId", args.spotId))
      .first();

    if (duplicate) {
      return { tripId: trip._id, tripStopId: duplicate._id };
    }

    const stops = await getTripStops(ctx, trip._id);
    const position = stops.length === 0 ? 0 : Math.max(...stops.map((stop) => stop.position)) + 1;
    const tripStopId = await ctx.db.insert("tripStops", {
      tripId: trip._id,
      destinationId: args.destinationId,
      spotId: args.spotId,
      position,
      status: "planned",
      updatedAt: now,
    });

    await touchTrip(ctx, trip._id);
    return { tripId: trip._id, tripStopId };
  },
});

export const removeStop = mutation({
  args: { tripStopId: v.id("tripStops") },
  handler: async (ctx, args) => {
    const { trip, stop } = await requireOwnedStop(ctx, args.tripStopId, ["planning"]);
    await ctx.db.delete(stop._id);

    const remainingStops = await getTripStops(ctx, trip._id);
    await Promise.all(
      remainingStops.map((remainingStop, index) =>
        remainingStop.position === index
          ? Promise.resolve()
          : ctx.db.patch(remainingStop._id, { position: index, updatedAt: Date.now() }),
      ),
    );
    await touchTrip(ctx, trip._id);
  },
});

export const moveStop = mutation({
  args: {
    tripStopId: v.id("tripStops"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { trip, stop } = await requireOwnedStop(ctx, args.tripStopId, ["planning"]);
    return await moveOwnedStop(ctx, trip, stop, args.direction);
  },
});

export const setNextStop = mutation({
  args: {
    destinationId: v.string(),
    spotId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    let trip = await getOpenExploreTrip(ctx, userId);

    if (!trip) {
      const tripId = await ctx.db.insert("trips", {
        userId,
        destinationId: exploreDestinationId,
        title: "Your adventure",
        status: "planning",
        routeMode: "walk",
        updatedAt: now,
      });
      trip = await ctx.db.get(tripId);
    }

    if (!trip) {
      throw new ConvexError("Could not create trip.");
    }

    const stops = await getTripStops(ctx, trip._id);
    let targetStop: Doc<"tripStops"> | null = stops.find((stop) => stop.spotId === args.spotId) ?? null;

    if (!targetStop) {
      if (trip.status === "active") {
        const tripStopId = await ctx.db.insert("tripStops", {
          tripId: trip._id,
          destinationId: args.destinationId,
          spotId: args.spotId,
          position: 0,
          status: "current",
          updatedAt: now,
        });
        targetStop = await ctx.db.get(tripStopId);
      } else {
        const tripStopId = await ctx.db.insert("tripStops", {
          tripId: trip._id,
          destinationId: args.destinationId,
          spotId: args.spotId,
          position: 0,
          status: "planned",
          updatedAt: now,
        });
        targetStop = await ctx.db.get(tripStopId);
      }
    }

    if (!targetStop) {
      throw new ConvexError("Trip stop not found.");
    }

    if (trip.status === "active") {
      if (targetStop.status === "done" || targetStop.status === "skipped") {
        throw new ConvexError("That stop is already finished.");
      }

      const latestStops = await getTripStops(ctx, trip._id);
      const orderedStops = [
        targetStop,
        ...latestStops.filter((stop) => stop._id !== targetStop._id),
      ];

      await Promise.all(
        orderedStops.map((stop, index) =>
          ctx.db.patch(stop._id, {
            position: index,
            status:
              stop._id === targetStop._id
                ? "current"
                : stop.status === "done" || stop.status === "skipped"
                  ? stop.status
                  : "planned",
            updatedAt: now,
          }),
        ),
      );
      await touchTrip(ctx, trip._id);
      return { tripId: trip._id, tripStopId: targetStop._id };
    }

    const latestStops = await getTripStops(ctx, trip._id);
    const orderedStops = [
      targetStop,
      ...latestStops.filter((stop) => stop._id !== targetStop._id),
    ];

    await Promise.all(
      orderedStops.map((stop, index) =>
        ctx.db.patch(stop._id, {
          position: index,
          status: "planned",
          updatedAt: now,
        }),
      ),
    );
    await touchTrip(ctx, trip._id);
    return { tripId: trip._id, tripStopId: targetStop._id };
  },
});

export const startTrip = mutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    const trip = await requireOwnedTrip(ctx, args.tripId, ["planning"]);
    const stops = await getTripStops(ctx, trip._id);

    if (stops.length === 0) {
      throw new ConvexError("Add at least one stop before starting.");
    }

    const now = Date.now();
    await Promise.all(
      stops.map((stop, index) =>
        ctx.db.patch(stop._id, {
          status: index === 0 ? "current" : "planned",
          position: index,
          updatedAt: now,
        }),
      ),
    );
    await ctx.db.patch(trip._id, { status: "active", startedAt: now, updatedAt: now });
    const updatedTrip = await ctx.db.get(trip._id);

    if (!updatedTrip) {
      throw new ConvexError("Trip not found.");
    }

    return await getTripPayload(ctx, updatedTrip);
  },
});

export const markStopDone = mutation({
  args: { tripStopId: v.id("tripStops") },
  handler: async (ctx, args) => {
    await completeStop(ctx, args.tripStopId, "done");
  },
});

export const skipStop = mutation({
  args: { tripStopId: v.id("tripStops") },
  handler: async (ctx, args) => {
    await completeStop(ctx, args.tripStopId, "skipped");
  },
});

async function completeStop(ctx: MutationCtx, tripStopId: Id<"tripStops">, status: "done" | "skipped") {
  const { trip, stop } = await requireOwnedStop(ctx, tripStopId, ["active"]);
  return await completeOwnedStop(ctx, trip, stop, status);
}

async function completeOwnedStop(
  ctx: MutationCtx,
  trip: Doc<"trips">,
  stop: Doc<"tripStops">,
  status: "done" | "skipped",
) {
  const stops = await getTripStops(ctx, trip._id);
  const now = Date.now();
  const nextStop = stops.find((candidate) => candidate.position > stop.position && candidate.status === "planned");

  await ctx.db.patch(stop._id, { status, updatedAt: now });

  if (nextStop) {
    await ctx.db.patch(nextStop._id, { status: "current", updatedAt: now });
    await ctx.db.patch(trip._id, { updatedAt: now });
  } else {
    await ctx.db.patch(trip._id, { status: "completed", completedAt: now, updatedAt: now });
  }

  const updatedTrip = await ctx.db.get(trip._id);

  if (!updatedTrip) {
    throw new ConvexError("Trip not found.");
  }

  return await getTripPayload(ctx, updatedTrip);
}

export const setRouteMode = mutation({
  args: {
    tripId: v.id("trips"),
    routeMode,
  },
  handler: async (ctx, args) => {
    const trip = await requireOwnedTrip(ctx, args.tripId, ["planning", "active"]);
    await ctx.db.patch(trip._id, { routeMode: args.routeMode, updatedAt: Date.now() });
    const updatedTrip = await ctx.db.get(trip._id);

    if (!updatedTrip) {
      throw new ConvexError("Trip not found.");
    }

    return await getTripPayload(ctx, updatedTrip);
  },
});

async function moveOwnedStop(
  ctx: MutationCtx,
  trip: Doc<"trips">,
  stop: Doc<"tripStops">,
  direction: "up" | "down",
) {
  const stops = await getTripStops(ctx, trip._id);
  const index = stops.findIndex((candidate) => candidate._id === stop._id);

  if (index === -1) {
    throw new ConvexError("Trip stop not found.");
  }

  const nextIndex = direction === "up" ? index - 1 : index + 1;

  if (nextIndex < 0 || nextIndex >= stops.length) {
    return await getTripPayload(ctx, trip);
  }

  const other = stops[nextIndex];
  const now = Date.now();
  await ctx.db.patch(stop._id, { position: other.position, updatedAt: now });
  await ctx.db.patch(other._id, { position: stop.position, updatedAt: now });
  await ctx.db.patch(trip._id, { updatedAt: now });
  const updatedTrip = await ctx.db.get(trip._id);

  if (!updatedTrip) {
    throw new ConvexError("Trip not found.");
  }

  return await getTripPayload(ctx, updatedTrip);
}

export const syncOfflineAction = mutation({
  args: {
    tripId: v.id("trips"),
    action: offlineAction,
  },
  handler: async (ctx, args) => {
    const trip = await requireOwnedTrip(ctx, args.tripId);

    if (trip.status === "completed") {
      return { applied: false, reason: "completed" as const, ...(await getTripPayload(ctx, trip)) };
    }

    if (args.action.type === "setRouteMode") {
      if (trip.status !== "planning" && trip.status !== "active") {
        return { applied: false, reason: "unsupportedStatus" as const, ...(await getTripPayload(ctx, trip)) };
      }

      await ctx.db.patch(trip._id, { routeMode: args.action.routeMode, updatedAt: Date.now() });
      const updatedTrip = await ctx.db.get(trip._id);

      if (!updatedTrip) {
        throw new ConvexError("Trip not found.");
      }

      return { applied: true, reason: null, ...(await getTripPayload(ctx, updatedTrip)) };
    }

    const stop = await ctx.db.get(args.action.tripStopId);

    if (!stop || stop.tripId !== trip._id) {
      throw new ConvexError("Trip stop not found.");
    }

    if (args.action.type === "moveStop") {
      if (trip.status !== "planning") {
        return { applied: false, reason: "unsupportedStatus" as const, ...(await getTripPayload(ctx, trip)) };
      }

      const payload = await moveOwnedStop(ctx, trip, stop, args.action.direction);
      return { applied: true, reason: null, ...payload };
    }

    if (trip.status !== "active") {
      return { applied: false, reason: "unsupportedStatus" as const, ...(await getTripPayload(ctx, trip)) };
    }

    if (stop.status === "done" || stop.status === "skipped") {
      return { applied: false, reason: "alreadyFinished" as const, ...(await getTripPayload(ctx, trip)) };
    }

    const payload = await completeOwnedStop(ctx, trip, stop, args.action.type === "markDone" ? "done" : "skipped");
    return { applied: true, reason: null, ...payload };
  },
});
