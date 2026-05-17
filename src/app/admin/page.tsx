"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Archive, Bed, CalendarDays, Check, Compass, Image as ImageIcon, Landmark, LayoutDashboard, Loader2, MapPin, Pencil, Plus, Route, Settings2, ShieldCheck, Utensils } from "lucide-react";
import React, { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AdminMapPicker } from "@/components/AdminMapPicker";

type Tab = "overview" | "types" | "picks" | "plans" | "requests";
type Status = "draft" | "active" | "archived";
type FieldKind = "text" | "textarea" | "select" | "number" | "url";
type TypeField = { key: string; label: string; kind: FieldKind; required: boolean; showOnCard: boolean; showOnDetail: boolean; options?: string[] };

type AdminType = {
  _id: Id<"poiTypes">;
  slug: string;
  label: string;
  pluralLabel: string;
  icon: string;
  isBookable: boolean;
  fields: TypeField[];
  status: "active" | "archived";
};

type AdminPick = {
  _id: Id<"pointsOfInterest">;
  id?: string;
  slug: string;
  name: string;
  typeId: Id<"poiTypes">;
  typeLabel?: string;
  city: string;
  country: string;
  summary: string;
  detail: string;
  tag: string;
  tags: string[];
  image: string;
  lngLat: [number, number];
  walkMin: number;
  driveMin: number;
  customFields: Record<string, string | number | boolean | null>;
  status: Status;
};

const tabs: Array<{ id: Tab; label: string; short: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Dashboard", short: "Home", hint: "Review content health.", icon: LayoutDashboard },
  { id: "types", label: "Pick Templates", short: "Templates", hint: "Define what each kind of Pick needs.", icon: Settings2 },
  { id: "picks", label: "Wandr Picks", short: "Picks", hint: "Create places users see on the map.", icon: MapPin },
  { id: "plans", label: "Adventures", short: "Trips", hint: "Build startable travel plans.", icon: Compass },
  { id: "requests", label: "Stay Requests", short: "Stays", hint: "Handle booking requests.", icon: CalendarDays },
];

const iconOptions = [
  { value: "map-pin", label: "Place", icon: MapPin },
  { value: "food", label: "Food", icon: Utensils },
  { value: "bed", label: "Stay", icon: Bed },
  { value: "landmark", label: "Landmark", icon: Landmark },
  { value: "route", label: "Route", icon: Route },
];

const blankType = {
  typeId: "" as Id<"poiTypes"> | "",
  slug: "",
  label: "",
  pluralLabel: "",
  icon: "map-pin",
  isBookable: false,
  fields: [] as TypeField[],
};

const blankPick = {
  poiId: "" as Id<"pointsOfInterest"> | "",
  typeId: "" as Id<"poiTypes"> | "",
  slug: "",
  name: "",
  city: "",
  country: "",
  summary: "",
  detail: "",
  tag: "",
  tags: "",
  image: "/placeholder.svg",
  longitude: "",
  latitude: "",
  walkMin: "10",
  driveMin: "5",
  status: "active" as Status,
  customFields: {} as Record<string, string>,
};

const blankPlan = {
  planId: "" as Id<"featuredTravelPlans"> | "",
  slug: "",
  title: "",
  summary: "",
  image: "/placeholder.svg",
  countries: "",
  durationLabel: "",
  status: "active" as Status,
  stopIds: [] as Id<"pointsOfInterest">[],
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function csv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-11 rounded-md bg-secondary px-3 text-sm outline-none ring-1 ring-transparent focus:ring-foreground ${props.className ?? ""}`} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-24 rounded-md bg-secondary p-3 text-sm outline-none ring-1 ring-transparent focus:ring-foreground ${props.className ?? ""}`} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-11 rounded-md bg-secondary px-3 text-sm outline-none ring-1 ring-transparent focus:ring-foreground ${props.className ?? ""}`} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function PanelHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {action}
    </div>
  );
}

export default function AdminPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const isAdmin = currentUser?.role === "admin";
  const data = useQuery(api.content.adminSuite, isAdmin ? {} : "skip");
  const legacyData = useQuery(api.content.adminList, isAdmin ? {} : "skip");
  const upsertType = useMutation(api.content.upsertPoiType);
  const archiveType = useMutation(api.content.archivePoiType);
  const upsertPick = useMutation(api.content.upsertPick);
  const archivePick = useMutation(api.content.archivePick);
  const restorePick = useMutation(api.content.restorePick);
  const upsertPlan = useMutation(api.content.upsertFeaturedPlan);
  const updateRequest = useMutation(api.content.updateBookingRequestStatus);
  const generateUploadUrl = useMutation(api.content.generateUploadUrl);

  const [tab, setTab] = useState<Tab>("overview");
  const [typeForm, setTypeForm] = useState(blankType);
  const [pickForm, setPickForm] = useState(blankPick);
  const [planForm, setPlanForm] = useState(blankPlan);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const types = (data?.types ?? []) as AdminType[];
  const activeTypes = types.filter((type) => type.status === "active");
  const legacyPicks = (legacyData?.spots ?? []).map((spot) => ({
    _id: spot._id as unknown as Id<"pointsOfInterest">,
    id: spot.slug,
    slug: spot.slug,
    name: spot.name ?? "",
    typeId: "" as Id<"poiTypes">,
    typeLabel: spot.category ?? "Pick",
    city: legacyData?.destinations?.find((destination) => destination._id === spot.destinationId)?.city ?? "",
    country: legacyData?.destinations?.find((destination) => destination._id === spot.destinationId)?.country ?? "",
    summary: spot.tip ?? "",
    detail: spot.tip ?? "",
    tag: spot.tag ?? "",
    tags: [],
    image: spot.image ?? "/placeholder.svg",
    lngLat: spot.lngLat ?? [0, 0],
    walkMin: spot.walkMin ?? 0,
    driveMin: spot.driveMin ?? 0,
    customFields: {},
    status: spot.status ?? "active",
  })) as AdminPick[];
  const picks = (((data?.picks?.length ?? 0) > 0 ? data?.picks : legacyPicks) ?? []).filter(Boolean) as AdminPick[];
  const activePicks = picks.filter((pick) => pick.status === "active");
  const selectedType = activeTypes.find((type) => type._id === pickForm.typeId) ?? activeTypes[0];

  const stats = useMemo(() => [
    { label: "Templates", value: types.length },
    { label: "Wandr Picks", value: picks.length },
    { label: "Adventures", value: data?.plans?.length ?? 0 },
    { label: "Stay Requests", value: data?.requests?.length ?? 0 },
  ], [data?.plans?.length, data?.requests?.length, picks.length, types.length]);

  const uploadImage = async (file: File, onDone: (storageId: string) => void) => {
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const json = await result.json();
      onDone(json.storageId);
    } finally {
      setBusy(false);
    }
  };

  const saveType = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await upsertType({
        typeId: typeForm.typeId || undefined,
        slug: slugify(typeForm.slug || typeForm.label),
        label: typeForm.label,
        pluralLabel: typeForm.pluralLabel || `${typeForm.label}s`,
        icon: typeForm.icon,
        isBookable: typeForm.isBookable,
        fields: typeForm.fields,
      });
      setTypeForm(blankType);
      setNotice("Saved.");
    } finally {
      setBusy(false);
    }
  };

  const savePick = async (event: FormEvent) => {
    event.preventDefault();
    const typeId = pickForm.typeId || selectedType?._id;
    if (!typeId) return;
    setBusy(true);
    try {
      await upsertPick({
        poiId: pickForm.poiId || undefined,
        typeId,
        slug: slugify(pickForm.slug || pickForm.name),
        name: pickForm.name,
        city: pickForm.city,
        country: pickForm.country,
        summary: pickForm.summary,
        detail: pickForm.detail || pickForm.summary,
        tag: pickForm.tag,
        tags: csv(pickForm.tags),
        image: pickForm.image,
        gallery: [],
        lngLat: [Number(pickForm.longitude), Number(pickForm.latitude)],
        walkMin: Number(pickForm.walkMin),
        driveMin: Number(pickForm.driveMin),
        customFields: pickForm.customFields,
        status: pickForm.status,
      });
      setPickForm({ ...blankPick, typeId });
      setNotice("Saved.");
    } finally {
      setBusy(false);
    }
  };

  const savePlan = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await upsertPlan({
        planId: planForm.planId || undefined,
        slug: slugify(planForm.slug || planForm.title),
        title: planForm.title,
        summary: planForm.summary,
        image: planForm.image,
        countries: csv(planForm.countries),
        durationLabel: planForm.durationLabel,
        status: planForm.status,
        stops: planForm.stopIds.map((poiId) => ({ poiId })),
      });
      setPlanForm(blankPlan);
      setNotice("Saved.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <main className="grid min-h-screen place-items-center"><Loader2 className="size-5 animate-spin" /></main>;
  if (!isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <ShieldCheck className="mx-auto size-8" />
          <h1 className="mt-3 text-2xl font-bold">Admin Access</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-5 sm:px-8 lg:grid-cols-[17rem_1fr]">
        <aside className="lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
          <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
            <Link href="/" className="block px-3 py-2 text-sm font-medium text-muted-foreground">Wandr</Link>
            <div className="px-3 pb-3">
              <h1 className="text-2xl font-bold leading-tight">Admin</h1>
              <span className="sr-only">Curate Spots</span>
            </div>
            <nav className="grid gap-1">
              {tabs.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors ${tab === item.id ? "bg-foreground text-background" : "hover:bg-secondary"}`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground">{tabs.find((item) => item.id === tab)?.hint}</div>
            <h1 className="text-4xl font-bold leading-tight">{tabs.find((item) => item.id === tab)?.label}</h1>
          </div>
          <div className="flex gap-2 overflow-x-auto lg:hidden">
            {tabs.map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)} className={`min-h-11 rounded-full px-4 text-sm font-medium ${tab === item.id ? "bg-foreground text-background" : "bg-secondary"}`}>
                {item.short}
              </button>
            ))}
          </div>
        </header>

        {notice ? <div className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">{notice}</div> : null}

        {tab === "overview" ? (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-secondary p-5">
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                  <div className="mt-1 text-3xl font-bold">{stat.value}</div>
                </div>
              ))}
            </section>
            <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
              <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
                <PanelHeader
                  title="Recent Picks"
                  action={<button type="button" onClick={() => setTab("picks")} className="min-h-10 rounded-full bg-foreground px-4 text-sm font-medium text-background">New Pick</button>}
                />
                <div className="mt-4 grid gap-3">
                  {picks.slice(0, 6).map((pick) => (
                    <div key={pick._id} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary p-4">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{pick.name}</div>
                        <div className="text-sm text-muted-foreground">{[pick.typeLabel, pick.city].filter(Boolean).join(" - ")}</div>
                      </div>
                      <div className="rounded-full bg-card px-3 py-1 text-xs font-medium">{pick.status}</div>
                    </div>
                  ))}
                  {picks.length === 0 ? <div className="rounded-2xl bg-secondary p-5 text-sm text-muted-foreground">No Picks yet.</div> : null}
                </div>
              </div>
              <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
                <PanelHeader title="Setup Order" />
                <div className="mt-4 grid gap-2 text-sm">
                  <button onClick={() => setTab("types")} className="flex min-h-12 items-center justify-between rounded-2xl bg-secondary px-4 text-left font-medium">1. Pick Templates <Settings2 className="size-4" /></button>
                  <button onClick={() => setTab("picks")} className="flex min-h-12 items-center justify-between rounded-2xl bg-secondary px-4 text-left font-medium">2. Wandr Picks <MapPin className="size-4" /></button>
                  <button onClick={() => setTab("plans")} className="flex min-h-12 items-center justify-between rounded-2xl bg-secondary px-4 text-left font-medium">3. Adventures <Compass className="size-4" /></button>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {tab === "types" ? (
          <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={saveType} className="rounded-2xl bg-card p-5 ring-1 ring-border">
              <PanelHeader title={typeForm.typeId ? "Edit Template" : "New Template"} />
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-secondary p-4">
                  <div className="mb-3 text-sm font-semibold">Public name</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Singular"><Input placeholder="Restaurant" value={typeForm.label} onChange={(e) => setTypeForm({ ...typeForm, label: e.target.value })} required /></Field>
                    <Field label="Plural"><Input placeholder="Restaurants" value={typeForm.pluralLabel} onChange={(e) => setTypeForm({ ...typeForm, pluralLabel: e.target.value })} /></Field>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="URL slug"><Input placeholder="restaurant" value={typeForm.slug} onChange={(e) => setTypeForm({ ...typeForm, slug: e.target.value })} /></Field>
                  <Field label="Icon"><Select value={typeForm.icon} onChange={(e) => setTypeForm({ ...typeForm, icon: e.target.value })}>
                    {iconOptions.map((icon) => <option key={icon.value} value={icon.value}>{icon.label}</option>)}
                  </Select></Field>
                </div>
                <label className="flex min-h-11 items-center gap-2 rounded-2xl bg-secondary px-4 text-sm font-medium"><input type="checkbox" checked={typeForm.isBookable} onChange={(e) => setTypeForm({ ...typeForm, isBookable: e.target.checked })} /> Accept stay requests</label>
                <button type="button" onClick={() => setTypeForm({ ...typeForm, fields: [...typeForm.fields, { key: "", label: "", kind: "text", required: false, showOnCard: false, showOnDetail: true }] })} className="min-h-11 rounded-full bg-secondary px-4 text-sm font-medium">
                  Add Detail Field
                </button>
                {typeForm.fields.map((field, index) => (
                  <div key={index} className="grid gap-2 rounded-2xl bg-secondary p-3">
                    <Field label="Field label"><Input placeholder="Cuisine" value={field.label} onChange={(e) => {
                      const fields = [...typeForm.fields];
                      fields[index] = { ...field, label: e.target.value, key: slugify(e.target.value) };
                      setTypeForm({ ...typeForm, fields });
                    }} /></Field>
                    <Field label="Field type"><Select value={field.kind} onChange={(e) => {
                      const fields = [...typeForm.fields];
                      fields[index] = { ...field, kind: e.target.value as FieldKind };
                      setTypeForm({ ...typeForm, fields });
                    }}>
                      <option value="text">Text</option>
                      <option value="textarea">Long text</option>
                      <option value="number">Number</option>
                      <option value="url">URL</option>
                    </Select></Field>
                    <label className="text-sm font-medium"><input type="checkbox" checked={field.showOnDetail} onChange={(e) => {
                      const fields = [...typeForm.fields];
                      fields[index] = { ...field, showOnDetail: e.target.checked };
                      setTypeForm({ ...typeForm, fields });
                    }} /> Show on details</label>
                  </div>
                ))}
                <button disabled={busy} className="min-h-11 rounded-full bg-foreground px-4 text-sm font-medium text-background">Save</button>
              </div>
            </form>
            <div className="grid gap-3">
              <PanelHeader title="Existing Templates" />
              {types.map((type) => {
                const Icon = iconOptions.find((icon) => icon.value === type.icon)?.icon ?? MapPin;
                return (
                  <div key={type._id} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-full bg-secondary"><Icon className="size-4" /></div>
                      <div className="min-w-0">
                        <div className="font-semibold">{type.pluralLabel}</div>
                        <div className="text-sm text-muted-foreground">{type.fields.length} fields</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setTypeForm({ typeId: type._id, slug: type.slug, label: type.label, pluralLabel: type.pluralLabel, icon: type.icon, isBookable: type.isBookable, fields: type.fields })} className="grid size-10 place-items-center rounded-full bg-secondary"><Pencil className="size-4" /></button>
                      <button onClick={() => void archiveType({ typeId: type._id })} className="grid size-10 place-items-center rounded-full bg-secondary"><Archive className="size-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {tab === "picks" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <form onSubmit={savePick} className="rounded-2xl bg-card p-5 ring-1 ring-border">
              <PanelHeader title={pickForm.poiId ? "Edit Wandr Pick" : "New Wandr Pick"} />
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-secondary p-4">
                  <div className="mb-3 text-sm font-semibold">What is it?</div>
                  <div className="grid gap-3">
                    <Field label="Template"><Select value={pickForm.typeId || selectedType?._id || ""} onChange={(e) => setPickForm({ ...pickForm, typeId: e.target.value as Id<"poiTypes"> })} required>
                      {activeTypes.map((type) => <option key={type._id} value={type._id}>{type.label}</option>)}
                    </Select></Field>
                    <Field label="Name"><Input placeholder="Joe's Beerhouse" value={pickForm.name} onChange={(e) => setPickForm({ ...pickForm, name: e.target.value })} required /></Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="City"><Input placeholder="Windhoek" value={pickForm.city} onChange={(e) => setPickForm({ ...pickForm, city: e.target.value })} required /></Field>
                      <Field label="Country"><Input placeholder="Namibia" value={pickForm.country} onChange={(e) => setPickForm({ ...pickForm, country: e.target.value })} required /></Field>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-secondary p-4">
                  <div className="mb-3 text-sm font-semibold">Public details</div>
                  <div className="grid gap-3">
                    <Field label="Short tag"><Input placeholder="Local classic" value={pickForm.tag} onChange={(e) => setPickForm({ ...pickForm, tag: e.target.value })} /></Field>
                    <Field label="Card summary"><Textarea placeholder="Short and useful." value={pickForm.summary} onChange={(e) => setPickForm({ ...pickForm, summary: e.target.value })} required /></Field>
                    <Field label="Details page"><Textarea placeholder="Everything users should know." value={pickForm.detail} onChange={(e) => setPickForm({ ...pickForm, detail: e.target.value })} /></Field>
                    <Field label="Search tags"><Input placeholder="food, local, dinner" value={pickForm.tags} onChange={(e) => setPickForm({ ...pickForm, tags: e.target.value })} /></Field>
                  </div>
                </div>
                <div className="rounded-2xl bg-secondary p-4">
                  <div className="mb-3 text-sm font-semibold">Map and media</div>
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Walk min"><Input type="number" value={pickForm.walkMin} onChange={(e) => setPickForm({ ...pickForm, walkMin: e.target.value })} /></Field>
                      <Field label="Drive min"><Input type="number" value={pickForm.driveMin} onChange={(e) => setPickForm({ ...pickForm, driveMin: e.target.value })} /></Field>
                    </div>
                    <AdminMapPicker center={pickForm.longitude && pickForm.latitude ? [Number(pickForm.longitude), Number(pickForm.latitude)] : [17.09, -22.55]} zoom={12} markerLngLat={pickForm.longitude && pickForm.latitude ? [Number(pickForm.longitude), Number(pickForm.latitude)] : null} markerLabel={pickForm.name} onChange={(lng, lat) => setPickForm({ ...pickForm, longitude: String(lng), latitude: String(lat) })} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Longitude"><Input value={pickForm.longitude} onChange={(e) => setPickForm({ ...pickForm, longitude: e.target.value })} required /></Field>
                      <Field label="Latitude"><Input value={pickForm.latitude} onChange={(e) => setPickForm({ ...pickForm, latitude: e.target.value })} required /></Field>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Image" value={pickForm.image} onChange={(e) => setPickForm({ ...pickForm, image: e.target.value })} />
                  <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-secondary"><ImageIcon className="size-4" /><input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && void uploadImage(e.target.files[0], (id) => setPickForm({ ...pickForm, image: id }))} /></label>
                </div>
                {selectedType?.fields.length ? (
                  <div className="rounded-2xl bg-secondary p-4">
                    <div className="mb-3 text-sm font-semibold">{selectedType.label} fields</div>
                    <div className="grid gap-3">
                      {selectedType.fields.map((field) => (
                        <Field key={field.key} label={field.label}>
                          <Input value={pickForm.customFields[field.key] ?? ""} onChange={(e) => setPickForm({ ...pickForm, customFields: { ...pickForm.customFields, [field.key]: e.target.value } })} />
                        </Field>
                      ))}
                    </div>
                  </div>
                ) : null}
                <button disabled={busy} className="min-h-11 rounded-full bg-foreground px-4 text-sm font-medium text-background">Save</button>
              </div>
            </form>
            <div className="grid content-start gap-3">
              <PanelHeader title="All Wandr Picks" />
              {picks.map((pick) => (
                <div key={pick._id} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{pick.name}</div>
                    <div className="text-sm text-muted-foreground">{pick.typeLabel} - {pick.city}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPickForm({ poiId: pick._id, typeId: pick.typeId, slug: pick.slug, name: pick.name, city: pick.city, country: pick.country, summary: pick.summary, detail: pick.detail, tag: pick.tag, tags: pick.tags?.join(", ") ?? "", image: pick.image, longitude: String(pick.lngLat?.[0] ?? ""), latitude: String(pick.lngLat?.[1] ?? ""), walkMin: String(pick.walkMin), driveMin: String(pick.driveMin), status: pick.status, customFields: Object.fromEntries(Object.entries(pick.customFields ?? {}).map(([key, value]) => [key, String(value ?? "")])) })} className="grid size-10 place-items-center rounded-full bg-secondary"><Pencil className="size-4" /></button>
                    {pick.status === "archived" ? <button onClick={() => void restorePick({ poiId: pick._id })} className="grid size-10 place-items-center rounded-full bg-secondary"><Check className="size-4" /></button> : <button onClick={() => void archivePick({ poiId: pick._id })} className="grid size-10 place-items-center rounded-full bg-secondary"><Archive className="size-4" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "plans" ? (
          <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={savePlan} className="rounded-2xl bg-card p-5 ring-1 ring-border">
              <PanelHeader title="New Adventure" />
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-secondary p-4">
                  <div className="mb-3 text-sm font-semibold">Trip card</div>
                  <div className="grid gap-3">
                    <Field label="Name"><Input placeholder="Weekend in Windhoek" value={planForm.title} onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })} required /></Field>
                    <Field label="Short summary"><Textarea placeholder="What users are starting." value={planForm.summary} onChange={(e) => setPlanForm({ ...planForm, summary: e.target.value })} /></Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Duration"><Input placeholder="2 days" value={planForm.durationLabel} onChange={(e) => setPlanForm({ ...planForm, durationLabel: e.target.value })} /></Field>
                      <Field label="Countries"><Input placeholder="Namibia, Botswana" value={planForm.countries} onChange={(e) => setPlanForm({ ...planForm, countries: e.target.value })} /></Field>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-secondary p-4">
                  <div className="mb-3 text-sm font-semibold">Stops</div>
                  <Select onChange={(e) => e.target.value && setPlanForm({ ...planForm, stopIds: [...planForm.stopIds, e.target.value as Id<"pointsOfInterest">] })} value="">
                    <option value="">Add Wandr Pick</option>
                    {activePicks.map((pick) => <option key={pick._id} value={pick._id}>{pick.name}</option>)}
                  </Select>
                  <ol className="mt-3 grid gap-2">
                    {planForm.stopIds.map((id, index) => <li key={`${id}-${index}`} className="rounded-2xl bg-card p-3 text-sm">{index + 1}. {activePicks.find((pick) => pick._id === id)?.name ?? "Pick"}</li>)}
                  </ol>
                </div>
                <button disabled={busy} className="min-h-11 rounded-full bg-foreground px-4 text-sm font-medium text-background">Save</button>
              </div>
            </form>
            <div className="grid content-start gap-3">
              <PanelHeader title="Published Adventures" />
              {data?.plans?.map((plan) => (
                <div key={plan._id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                  <div className="font-semibold">{plan.title}</div>
                  <div className="text-sm text-muted-foreground">{plan.durationLabel} - {plan.stops.length} stops</div>
                </div>
              ))}
              {data?.plans?.length === 0 ? <div className="rounded-2xl bg-secondary p-5 text-sm text-muted-foreground">No adventures yet.</div> : null}
            </div>
          </section>
        ) : null}

        {tab === "requests" ? (
          <section className="grid gap-3">
            <PanelHeader title="Stay Request Inbox" />
            {data?.requests?.map((request) => (
              <div key={request._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                <div>
                  <div className="font-semibold">{request.startDate} to {request.endDate}</div>
                  <div className="text-sm text-muted-foreground">{request.guests} guests - {request.status}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void updateRequest({ requestId: request._id, status: "confirmed" })} className="min-h-10 rounded-full bg-foreground px-4 text-sm font-medium text-background">Confirm</button>
                  <button onClick={() => void updateRequest({ requestId: request._id, status: "declined" })} className="min-h-10 rounded-full bg-secondary px-4 text-sm font-medium">Decline</button>
                </div>
              </div>
            ))}
            {data?.requests?.length === 0 ? <div className="rounded-2xl bg-secondary p-5 text-sm text-muted-foreground">No requests.</div> : null}
          </section>
        ) : null}
      </div>
      </div>
    </main>
  );
}
