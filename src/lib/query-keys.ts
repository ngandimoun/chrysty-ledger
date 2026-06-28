export const queryKeys = {
  workspaces: (ledgerKey: string) => ["workspaces", ledgerKey] as const,
  assets: (workspaceId: string, scopeKey: string) =>
    ["assets", workspaceId, scopeKey] as const,
  messages: (workspaceId: string, scopeKey: string) =>
    ["messages", workspaceId, scopeKey] as const,
  userProfile: (userId: string | "anon") => ["user-profile", userId] as const,
};
