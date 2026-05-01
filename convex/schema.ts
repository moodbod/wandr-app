import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    homeCity: v.optional(v.string()),
    travelPreferences: v.optional(v.array(v.string())),
    onboardingCompleted: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  destinations: defineTable({
    city: v.string(),
    country: v.string(),
    flag: v.string(),
    you: v.object({
      top: v.string(),
      left: v.string(),
    }),
  }),
  spots: defineTable({
    destinationId: v.id("destinations"),
    slug: v.string(),
    name: v.string(),
    category: v.union(v.literal("eat"), v.literal("see"), v.literal("gems"), v.literal("routes")),
    top: v.string(),
    left: v.string(),
    walkMin: v.number(),
    driveMin: v.number(),
    tip: v.string(),
    tag: v.string(),
    image: v.string(),
  }).index("by_destination", ["destinationId"]),
  trips: defineTable({
    userId: v.id("users"),
    destinationId: v.string(),
    title: v.string(),
    status: v.union(v.literal("planning"), v.literal("active"), v.literal("completed")),
    routeMode: v.union(v.literal("walk"), v.literal("drive")),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_userId_and_destinationId_and_status", ["userId", "destinationId", "status"])
    .index("by_userId_and_destinationId", ["userId", "destinationId"])
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"]),
  tripStops: defineTable({
    tripId: v.id("trips"),
    destinationId: v.string(),
    spotId: v.string(),
    position: v.number(),
    status: v.union(v.literal("planned"), v.literal("current"), v.literal("done"), v.literal("skipped")),
    updatedAt: v.number(),
  })
    .index("by_tripId_and_position", ["tripId", "position"])
    .index("by_tripId_and_spotId", ["tripId", "spotId"]),
});
