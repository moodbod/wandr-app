// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { AuthProviderMaterializedConfig, ConvexAuthConfig } from "@convex-dev/auth/server";
import { createOrUpdateWandrUser } from "./auth";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type CreateOrUpdateUserCallback = NonNullable<NonNullable<ConvexAuthConfig["callbacks"]>["createOrUpdateUser"]>;
type CreateOrUpdateUserArgs = Parameters<CreateOrUpdateUserCallback>[1];

const googleProvider = {
  id: "google",
  name: "Google",
  type: "oidc",
} as AuthProviderMaterializedConfig;

const passwordProvider = {
  id: "password",
  name: "Password",
  type: "credentials",
} as unknown as AuthProviderMaterializedConfig;

function testBackend() {
  return convexTest(schema, modules);
}

function authArgs(args: Partial<CreateOrUpdateUserArgs> & Pick<CreateOrUpdateUserArgs, "profile" | "type">) {
  return {
    existingUserId: null,
    provider: args.type === "credentials" ? passwordProvider : googleProvider,
    ...args,
  } as CreateOrUpdateUserArgs;
}

describe("Convex Auth account linking", () => {
  it("links Google sign-in to an existing password user by normalized email", async () => {
    const t = testBackend();
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "traveler@example.com",
        name: "Password Name",
        onboardingCompleted: true,
        role: "admin",
      });
    });

    const linkedUserId = await t.run(async (ctx) => {
      return await createOrUpdateWandrUser(
        ctx,
        authArgs({
          type: "oauth",
          profile: {
            email: "Traveler@Example.com",
            emailVerified: true,
            image: "https://example.com/avatar.png",
            name: "Google Name",
          },
        }),
      );
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(linkedUserId).toBe(userId);
    expect(user).toMatchObject({
      email: "traveler@example.com",
      image: "https://example.com/avatar.png",
      name: "Google Name",
      onboardingCompleted: true,
      role: "admin",
    });
    expect(user?.emailVerificationTime).toEqual(expect.any(Number));
  });

  it("rejects password signup when a Google account already owns the email", async () => {
    const t = testBackend();
    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "traveler@example.com",
        emailVerificationTime: Date.now(),
        role: "traveler",
      });
    });

    await expect(
      t.run(async (ctx) => {
        return await createOrUpdateWandrUser(
          ctx,
          authArgs({
            type: "credentials",
            profile: {
              email: "traveler@example.com",
            },
          }),
        );
      }),
    ).rejects.toThrow("An account already exists for this email");

    const users = await t.run(async (ctx) => {
      return await ctx.db.query("users").withIndex("email", (q) => q.eq("email", "traveler@example.com")).take(2);
    });

    expect(users).toHaveLength(1);
  });

  it("creates new Google users as travelers who still need onboarding", async () => {
    const t = testBackend();
    const userId = await t.run(async (ctx) => {
      return await createOrUpdateWandrUser(
        ctx,
        authArgs({
          type: "oauth",
          profile: {
            email: "new@example.com",
            emailVerified: true,
            name: "New Traveler",
          },
        }),
      );
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId as Id<"users">);
    });

    expect(user).toMatchObject({
      email: "new@example.com",
      name: "New Traveler",
      role: "traveler",
    });
    expect(user?.emailVerificationTime).toEqual(expect.any(Number));
    expect(user?.onboardingCompleted).toBeUndefined();
  });
});
