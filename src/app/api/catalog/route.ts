import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";

export const revalidate = 300;

export async function GET() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    return NextResponse.json(
      { error: "Convex is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const client = new ConvexHttpClient(convexUrl);
  const catalog = await client.query(api.content.listPublic, {});

  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
