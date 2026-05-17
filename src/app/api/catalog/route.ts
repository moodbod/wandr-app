import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";

export const revalidate = 300;
export const dynamic = "force-dynamic";

export async function GET() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    return NextResponse.json(
      { error: "Convex is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const client = new ConvexHttpClient(convexUrl);
  let catalog;
  try {
    catalog = await client.query(api.content.listWandrPicksPublic, {});
  } catch {
    return NextResponse.json(
      { types: [], picks: [], destinations: [], featuredPlans: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
