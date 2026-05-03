import Google, { type GoogleProfile } from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth, type ConvexAuthConfig } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

type CreateOrUpdateUserCallback = NonNullable<NonNullable<ConvexAuthConfig["callbacks"]>["createOrUpdateUser"]>;
type CreateOrUpdateUserArgs = Parameters<CreateOrUpdateUserCallback>[1];
type UserPatch = Partial<
  Pick<
    Doc<"users">,
    "email" | "emailVerificationTime" | "image" | "name"
  >
>;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function profileString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function userByEmail(ctx: MutationCtx, email: string) {
  const users = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).take(2);

  if (users.length > 1) {
    throw new ConvexError("Multiple Wandr accounts already use this email. Please contact support.");
  }

  return users[0] ?? null;
}

function userPatchFromProfile(args: CreateOrUpdateUserArgs) {
  const email = normalizeEmail(args.profile.email);

  if (!email || !email.includes("@")) {
    throw new ConvexError("Enter a valid email address.");
  }

  const patch: UserPatch = {
    email,
  };
  const name = profileString(args.profile.name);
  const image = profileString(args.profile.image);

  if (name) {
    patch.name = name;
  }

  if (image) {
    patch.image = image;
  }

  if (args.provider.id === "google" && args.profile.emailVerified) {
    patch.emailVerificationTime = Date.now();
  }

  return patch;
}

export async function createOrUpdateWandrUser(ctx: MutationCtx, args: CreateOrUpdateUserArgs): Promise<Id<"users">> {
  const patch = userPatchFromProfile(args);
  const email = patch.email;

  if (!email) {
    throw new ConvexError("Enter a valid email address.");
  }

  if (args.existingUserId) {
    const existingUser = await ctx.db.get(args.existingUserId as Id<"users">);

    if (!existingUser) {
      throw new ConvexError("Not authenticated");
    }

    await ctx.db.patch(existingUser._id, patch);
    return existingUser._id;
  }

  const existingUser = await userByEmail(ctx, email);

  if (existingUser) {
    if (args.type === "credentials") {
      throw new ConvexError("An account already exists for this email. Sign in instead.");
    }

    await ctx.db.patch(existingUser._id, patch);
    return existingUser._id;
  }

  return await ctx.db.insert("users", {
    ...patch,
    role: "traveler",
  });
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      profile(profile: GoogleProfile) {
        const email = normalizeEmail(profile.email);

        if (!email || !email.includes("@")) {
          throw new ConvexError("Google did not return a usable email address.");
        }

        if (!profile.email_verified) {
          throw new ConvexError("Google did not verify this email address.");
        }

        return {
          id: profile.sub,
          email,
          emailVerified: profile.email_verified,
          image: profile.picture,
          name: profile.name,
          role: "traveler" as const,
        };
      },
    }),
    Password<DataModel>({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();

        if (!email || !email.includes("@")) {
          throw new ConvexError("Enter a valid email address.");
        }

        return params.flow === "signUp" ? { email, role: "traveler" } : { email };
      },
      validatePasswordRequirements(password) {
        if (password.length < 8) {
          throw new ConvexError("Password must be at least 8 characters.");
        }
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      return await createOrUpdateWandrUser(ctx as MutationCtx, args);
    },
  },
});
