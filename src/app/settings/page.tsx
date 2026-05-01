import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="size-4" />
          Wandr
        </Link>

        <section className="space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your Wandr account preferences.</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="text-sm font-medium">Account</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Profile and trip settings will appear here.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
