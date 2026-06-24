export const queryKeys = {
  workspaces: (ledgerKey: string) => ["workspaces", ledgerKey] as const,
  assets: (workspaceId: string) => ["assets", workspaceId] as const,
  messages: (workspaceId: string) => ["messages", workspaceId] as const,
  userProfile: () => ["user-profile"] as const,
};
