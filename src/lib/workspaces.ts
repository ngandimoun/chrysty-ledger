export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
};

export function createWorkspaceRecord(name: string): Workspace {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
}
