"use client";

import { useQuery } from "@tanstack/react-query";

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
  return useQuery({
    queryKey: queryKeys.userProfile(),
    queryFn: fetchUserProfile,
  });
}
