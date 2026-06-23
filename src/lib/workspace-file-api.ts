export async function fetchWorkspaceFileUrl(input: {
  workspaceId: string;
  assetId: string;
  ledgerKey: string;
  userId?: string | null;
}): Promise<string> {
  const headers: Record<string, string> = {
    "x-ledger-key": input.ledgerKey,
  };
  if (input.userId) {
    headers["x-ledger-user-id"] = input.userId;
  }

  const response = await fetch(
    `/api/workspace/${input.workspaceId}/assets/${input.assetId}/file?format=json`,
    { headers }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody && typeof errorBody === "object" && "error" in errorBody
        ? String((errorBody as { error: string }).error)
        : `Failed to load file (${response.status}).`;
    throw new Error(message);
  }

  const body = (await response.json()) as { url?: string };
  if (!body.url) {
    throw new Error("File URL was not returned.");
  }

  return body.url;
}

export function buildWorkspaceFileUrl(workspaceId: string, assetId: string): string {
  return `/api/workspace/${workspaceId}/assets/${assetId}/file`;
}
