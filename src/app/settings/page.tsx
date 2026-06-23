"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage your Chrysty preferences.
      </p>

      <section className="mt-8 space-y-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Appearance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch between light and dark mode.
          </p>
          <div className="mt-4">
            <ThemeToggle />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to claim this browser&apos;s workspaces to your account — coming soon.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspaces, messages, and assets sync to Chrysty via Supabase. This browser
            uses an anonymous ledger key until you sign in.
          </p>
        </div>
      </section>
    </div>
  );
}
