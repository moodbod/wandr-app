import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type UserRole = "traveler" | "admin";

export function getCurrentUserRole(user: Doc<"users"> | null): UserRole {
  return user?.role === "admin" ? "admin" : "traveler";
}

export async function requireAuthenticatedUser(ctx: QueryCtx | MutationCtx): Promise<{
  userId: Id<"users">;
  user: Doc<"users">;
  role: UserRole;
}> {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new ConvexError("Not authenticated");
  }

  const user = await ctx.db.get(userId);

  if (!user) {
    throw new ConvexError("Not authenticated");
  }

  return { userId, user, role: getCurrentUserRole(user) };
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const currentUser = await requireAuthenticatedUser(ctx);

  if (currentUser.role !== "admin") {
    throw new ConvexError("Unauthorized");
  }

  return currentUser;
}
