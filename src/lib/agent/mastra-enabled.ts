import "server-only";

export function isMastraStorageConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function isMastraAgentLayerEnabled(): boolean {
  return isMastraStorageConfigured() && Boolean(process.env.MOONSHOT_API_KEY?.trim());
}
