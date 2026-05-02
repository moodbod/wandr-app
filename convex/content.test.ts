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

async function createUser(t: ReturnType<typeof testBackend>, role?: "traveler" | "admin") {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: `${role ?? "traveler"}-${Math.random()}@example.com`,
      name: "Test User",
      onboardingCompleted: true,
      ...(role ? { role } : {}),
    });
  });

  return { userId, authed: t.withIdentity({ subject: userId }) };
}

async function createDestination(t: ReturnType<typeof testBackend>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("destinations", {
      slug: "windhoek",
      city: "Windhoek",
      country: "Namibia",
      flag: "NA",
      map: { center: [17.0832, -22.5597], zoom: 12 },
      you: { top: "50%", left: "50%", lngLat: [17.0832, -22.5597] },
      status: "active",
      updatedAt: Date.now(),
    });
  });
}

function spotArgs(destinationId: Id<"destinations">, slug = "coffee-stop") {
  return {
    destinationId,
    slug,
    name: "Coffee Stop",
    category: "eat" as const,
    top: "50%",
    left: "50%",
    lngLat: [17.09, -22.55],
    walkMin: 8,
    driveMin: 3,
    tag: "Cafe",
    tip: "Good first stop.",
    image: "/placeholder.svg",
  };
}

describe("roles", () => {
  it("resolves missing roles as traveler", async () => {
    const t = testBackend();
    const { authed } = await createUser(t);

    const user = await authed.query(api.users.current, {});

    expect(user?.role).toBe("traveler");
  });

  it("preserves explicit traveler roles", async () => {
    const t = testBackend();
    const { authed } = await createUser(t, "traveler");

    const user = await authed.query(api.users.current, {});

    expect(user?.role).toBe("traveler");
  });
});

describe("admin content", () => {
  it("rejects non-admin content mutations", async () => {
    const t = testBackend();
    const destinationId = await createDestination(t);
    const { authed } = await createUser(t, "traveler");

    await expect(authed.mutation(api.content.createSpot, spotArgs(destinationId))).rejects.toThrow("Unauthorized");
  });

  it("allows admins to create, update, archive, and restore spots", async () => {
    const t = testBackend();
    const destinationId = await createDestination(t);
    const { authed } = await createUser(t, "admin");

    const spotId = await authed.mutation(api.content.createSpot, spotArgs(destinationId));
    await authed.mutation(api.content.updateSpot, {
      spotId,
      ...spotArgs(destinationId, "coffee-stop-updated"),
      name: "Updated Coffee Stop",
    });
    await authed.mutation(api.content.archiveSpot, { spotId });

    let adminData = await authed.query(api.content.adminList, {});
    expect(adminData.spots.find((spot) => spot._id === spotId)?.status).toBe("archived");

    await authed.mutation(api.content.restoreSpot, { spotId });
    adminData = await authed.query(api.content.adminList, {});
    expect(adminData.spots.find((spot) => spot._id === spotId)?.status).toBe("active");
  });

  it("excludes archived spots from public content", async () => {
    const t = testBackend();
    const destinationId = await createDestination(t);
    const { authed } = await createUser(t, "admin");
    const spotId = await authed.mutation(api.content.createSpot, spotArgs(destinationId));

    expect((await t.query(api.content.listPublic, {}))[0]?.spots).toHaveLength(1);

    await authed.mutation(api.content.archiveSpot, { spotId });

    expect((await t.query(api.content.listPublic, {}))[0]?.spots).toHaveLength(0);
  });
});
