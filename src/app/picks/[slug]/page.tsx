import { ConvexHttpClient } from "convex/browser";
import { ArrowLeft, CalendarDays, Car, Footprints, MapPin, Navigation, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { SpotImage } from "@/components/SpotImage";

type PickPageProps = {
  params: { slug: string };
};

export const revalidate = 300;

export default async function PickPage({ params }: PickPageProps) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) notFound();

  const client = new ConvexHttpClient(convexUrl);
  const pick = await client.query(api.content.getPickBySlug, { slug: params.slug });
  if (!pick) notFound();

  const detailFields = (pick.typeFields ?? [])
    .filter((field) => field.showOnDetail)
    .map((field) => ({ ...field, value: pick.customFields?.[field.key] }))
    .filter((field) => field.value !== undefined && field.value !== null && `${field.value}`.trim() !== "");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-8 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium">
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <div className="rounded-full bg-secondary px-4 py-2 text-sm font-medium">{pick.typeLabel}</div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            <div className="relative aspect-[4/3]">
              <SpotImage src={pick.image} alt={pick.name} fill priority sizes="(min-width: 1024px) 58vw, 100vw" className="object-cover" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="size-4" />
                <span>{[pick.city, pick.country].filter(Boolean).join(", ")}</span>
              </div>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">{pick.name}</h1>
              <p className="mt-3 text-base leading-7 text-muted-foreground">{pick.detail || pick.summary}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-secondary p-4">
                <Footprints className="size-4" />
                <div className="mt-2 text-xl font-bold">{pick.walkMin} min</div>
                <div className="text-sm text-muted-foreground">Walk</div>
              </div>
              <div className="rounded-2xl bg-secondary p-4">
                <Car className="size-4" />
                <div className="mt-2 text-xl font-bold">{pick.driveMin} min</div>
                <div className="text-sm text-muted-foreground">Drive</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/?pick=${pick.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background">
                <Plus className="size-4" />
                Add
              </Link>
              <Link href={`/?route=${pick.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-5 text-sm font-medium">
                <Navigation className="size-4" />
                Route
              </Link>
              {pick.isBookable ? (
                <Link href={`/?stay=${pick.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-5 text-sm font-medium">
                  <CalendarDays className="size-4" />
                  Request
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {detailFields.length > 0 ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {detailFields.map((field) => (
              <div key={field.key} className="rounded-2xl bg-secondary p-5">
                <div className="text-sm font-medium text-muted-foreground">{field.label}</div>
                <div className="mt-1 text-base font-semibold">{String(field.value)}</div>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
