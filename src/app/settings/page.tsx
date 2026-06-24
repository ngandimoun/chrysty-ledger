"use client";

import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getLoginRedirectUrl } from "@/lib/chrysty/constants";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (response.ok) {
          const profile = (await response.json()) as { email?: string };
          if (!cancelled) setEmail(profile.email ?? null);
        } else if (!cancelled) {
          setEmail(null);
        }
      } catch {
        if (!cancelled) setEmail(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = getLoginRedirectUrl(window.location.origin);
  }

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
            {loading
              ? "Loading account…"
              : email
                ? `Signed in as ${email}`
                : "Sign in with your Chrysty account to sync workspaces across devices."}
          </p>
          <div className="mt-4">
            {email ? (
              <Button variant="outline" onClick={() => void handleSignOut()}>
                Sign out
              </Button>
            ) : (
              <Button
                onClick={() => {
                  window.location.href = getLoginRedirectUrl(window.location.href);
                }}
              >
                Sign in on chrysty.dev
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspaces, messages, and assets sync to Chrysty via Supabase. Anonymous
            browser sessions are claimed to your account when you sign in.
          </p>
        </div>
      </section>
    </div>
  );
}
