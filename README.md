# Wandr

Wandr is a Next.js travel app prototype for local destination picks, routes, and spot details.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/Radix UI
- Convex
- Bun

## Development

Install dependencies:

```bash
bun install
```

Run the app:

```bash
bun run dev
```

Run Convex locally:

```bash
bun run convex:dev
```

Or run the Convex CLI directly:

```bash
bunx convex dev
```

Do not use `bunx run convex`; that invokes a different runner and tries to
execute the `convex/` directory as a Node module.

## Auth setup

This app uses Convex Auth with email/password and Google sign-in. After linking
a Convex deployment, configure the auth environment:

```bash
bunx convex env set SITE_URL http://localhost:3000
bunx convex env set JWT_PRIVATE_KEY "<generated private key>"
bunx convex env set JWKS "<generated JWKS>"
bunx convex env set AUTH_GOOGLE_ID "<google OAuth client id>"
bunx convex env set AUTH_GOOGLE_SECRET "<google OAuth client secret>"
```

In the Google OAuth client, set the authorized redirect URI to your Convex HTTP
Actions URL plus `/api/auth/callback/google`, for example:

```text
https://<your-deployment>.convex.site/api/auth/callback/google
```

Google sign-ins are linked to existing password accounts by normalized email.
New Google users are created as traveler accounts and still need to complete
onboarding before trip features unlock.

`bunx convex dev` will populate `NEXT_PUBLIC_CONVEX_URL` and related Convex
values for the Next.js app. Keep `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in
`.env.local` for the public map.
