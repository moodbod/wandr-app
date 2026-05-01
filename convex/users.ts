import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

const preferenceValues = ["eat", "see", "gems", "routes"] as const;

function normalizePreferences(preferences: string[]) {
  return [...new Set(preferences.filter((value) => preferenceValues.includes(value as never)))];
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return null;
    }

    return await ctx.db.get(userId);
  },
});

export const completeOnboarding = mutation({
  args: {
    name: v.string(),
    homeCountry: v.string(),
    travelPreferences: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new ConvexError("You must be signed in to finish onboarding.");
    }

    const name = args.name.trim();
    const homeCountry = args.homeCountry.trim();
    const travelPreferences = normalizePreferences(args.travelPreferences);

    if (!name || !homeCountry || travelPreferences.length === 0) {
      throw new ConvexError("Complete your name, home country, and at least one preference.");
    }

    await ctx.db.patch(userId, {
      name,
      homeCountry,
      travelPreferences,
      onboardingCompleted: true,
    });
  },
});

export const updateSettings = mutation({
  args: {
    name: v.string(),
    homeCountry: v.string(),
    travelPreferences: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new ConvexError("You must be signed in to update settings.");
    }

    const name = args.name.trim();
    const homeCountry = args.homeCountry.trim();
    const travelPreferences = normalizePreferences(args.travelPreferences);

    if (!name || !homeCountry || travelPreferences.length === 0) {
      throw new ConvexError("Complete your name, home country, and at least one preference.");
    }

    await ctx.db.patch(userId, {
      name,
      homeCountry,
      travelPreferences,
      onboardingCompleted: true,
    });
  },
});
