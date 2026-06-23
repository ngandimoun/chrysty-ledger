import { WorkspacePageClient } from "@/app/workspace/[id]/workspace-page-client";

type WorkspacePageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;

  return <WorkspacePageClient workspaceId={id} />;
}
