"use client";

import { useQuery } from "@tanstack/react-query";

import { useLedger } from "@/contexts/ledger-context";
import { queryKeys } from "@/lib/query-keys";

type UserProfile = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

async function fetchUserProfile(): Promise<UserProfile> {
  const response = await fetch("/api/auth/me", { credentials: "include" });

  if (!response.ok) {
    throw new Error("Failed to load user profile");
  }

  return response.json() as Promise<UserProfile>;
}

export function getUserFirstName(profile: Pick<UserProfile, "fullName" | "email">) {
  const fromName = profile.fullName?.trim().split(/\s+/)[0];
  if (fromName) return fromName;

  const fromEmail = profile.email.split("@")[0]?.trim();
  return fromEmail || "User";
}

export function useUserProfileQuery() {
  const { userId, authSettled } = useLedger();
  const profileKey = userId ?? "anon";

  return useQuery({
    queryKey: queryKeys.userProfile(profileKey),
    queryFn: fetchUserProfile,
    enabled: authSettled,
  });
}
