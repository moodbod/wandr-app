// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function testBackend() {
  return convexTest(schema, modules);
}

async function createUser(t: ReturnType<typeof testBackend>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      onboardingCompleted: true,
    });
  });

  return {
    userId,
    authed: t.withIdentity({ subject: userId }),
  };
}

async function createTrip(
  t: ReturnType<typeof testBackend>,
  args: {
    userId: Id<"users">;
    destinationId: string;
    status: "planning" | "active" | "completed";
    updatedAt: number;
    spotId?: string;
  },
) {
  return await t.run(async (ctx) => {
    const tripId = await ctx.db.insert("trips", {
      userId: args.userId,
      destinationId: args.destinationId,
      title: "Your adventure",
      status: args.status,
      routeMode: "walk",
      updatedAt: args.updatedAt,
    });

    if (args.spotId) {
      await ctx.db.insert("tripStops", {
        tripId,
        destinationId: args.destinationId,
        spotId: args.spotId,
        position: 0,
        status: args.status === "active" ? "current" : "planned",
        updatedAt: args.updatedAt,
      });
    }

    return tripId;
  });
}

describe("trips.resumeActive", () => {
  it("returns the preferred owned active trip", async () => {
    const t = testBackend();
    const { userId, authed } = await createUser(t);
    const preferredTripId = await createTrip(t, {
      userId,
      destinationId: "windhoek",
      status: "active",
      updatedAt: 1,
      spotId: "joes-beerhouse",
    });
    await createTrip(t, {
      userId,
      destinationId: "swakopmund",
      status: "active",
      updatedAt: 2,
      spotId: "jetty-1905",
    });

    const result = await authed.query(api.trips.resumeActive, { preferredTripId });

    expect(result?.trip._id).toBe(preferredTripId);
    expect(result?.stops).toHaveLength(1);
  });

  it("falls back to the most recently updated active trip", async () => {
    const t = testBackend();
    const { userId, authed } = await createUser(t);
    await createTrip(t, {
      userId,
      destinationId: "windhoek",
      status: "active",
      updatedAt: 1,
      spotId: "joes-beerhouse",
    });
    const recentTripId = await createTrip(t, {
      userId,
      destinationId: "swakopmund",
      status: "active",
      updatedAt: 5,
      spotId: "jetty-1905",
    });

    const result = await authed.query(api.trips.resumeActive, {});

    expect(result?.trip._id).toBe(recentTripId);
  });

  it("ignores planning and completed trips", async () => {
    const t = testBackend();
    const { userId, authed } = await createUser(t);
    await createTrip(t, {
      userId,
      destinationId: "windhoek",
      status: "planning",
      updatedAt: 5,
      spotId: "joes-beerhouse",
    });
    await createTrip(t, {
      userId,
      destinationId: "swakopmund",
      status: "completed",
      updatedAt: 10,
      spotId: "jetty-1905",
    });

    await expect(authed.query(api.trips.resumeActive, {})).resolves.toBeNull();
  });

  it("does not return another user's preferred trip", async () => {
    const t = testBackend();
    const userOne = await createUser(t);
    const userTwo = await createUser(t);
    const otherTripId = await createTrip(t, {
      userId: userOne.userId,
      destinationId: "windhoek",
      status: "active",
      updatedAt: 10,
      spotId: "joes-beerhouse",
    });

    const result = await userTwo.authed.query(api.trips.resumeActive, { preferredTripId: otherTripId });

    expect(result).toBeNull();
  });
});

describe("trips Explore planning", () => {
  it("creates one Namibia trip with stops from multiple destinations", async () => {
    const t = testBackend();
    const { authed } = await createUser(t);

    const first = await authed.mutation(api.trips.addStop, {
      destinationId: "windhoek",
      spotId: "joes-beerhouse",
    });
    const second = await authed.mutation(api.trips.addStop, {
      destinationId: "swakopmund",
      spotId: "jetty-1905",
    });

    expect(second.tripId).toBe(first.tripId);

    const result = await authed.query(api.trips.getActiveForExplore, {});

    expect(result?.trip.destinationId).toBe("namibia");
    expect(result?.stops).toMatchObject([
      { destinationId: "windhoek", spotId: "joes-beerhouse", position: 0 },
      { destinationId: "swakopmund", spotId: "jetty-1905", position: 1 },
    ]);
  });

  it("prevents duplicate mixed-trip spots by spot id", async () => {
    const t = testBackend();
    const { authed } = await createUser(t);

    const first = await authed.mutation(api.trips.addStop, {
      destinationId: "windhoek",
      spotId: "joes-beerhouse",
    });
    const duplicate = await authed.mutation(api.trips.addStop, {
      destinationId: "swakopmund",
      spotId: "joes-beerhouse",
    });

    const result = await authed.query(api.trips.getActiveForExplore, {});

    expect(duplicate.tripId).toBe(first.tripId);
    expect(duplicate.tripStopId).toBe(first.tripStopId);
    expect(result?.stops).toHaveLength(1);
    expect(result?.stops[0]).toMatchObject({ destinationId: "windhoek", spotId: "joes-beerhouse" });
  });
});
