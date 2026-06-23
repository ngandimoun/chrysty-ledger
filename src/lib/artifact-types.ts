export type TableArtifact = {
  id: string;
  kind: "table";
  title: string;
  columns: string[];
  rows: Record<string, string>[];
};

export type ChartDataPoint = {
  label: string;
  value: number;
};

export type ChartArtifact = {
  id: string;
  kind: "chart";
  title: string;
  chartType: "bar" | "pie";
  data: ChartDataPoint[];
};

export type FileListItem = {
  name: string;
  size: string;
};

export type FileListArtifact = {
  id: string;
  kind: "file-list";
  title: string;
  files: FileListItem[];
};

export type DocumentArtifact = {
  id: string;
  kind: "document";
  title: string;
  content: string;
};

export type DashboardKpi = {
  label: string;
  value: string;
};

export type DashboardArtifact = {
  id: string;
  kind: "dashboard";
  title: string;
  kpis: DashboardKpi[];
  chart?: Omit<ChartArtifact, "id" | "kind" | "title">;
};

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  rate: string;
  amount: string;
};

export type InvoiceArtifact = {
  id: string;
  kind: "invoice";
  title: string;
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  total: string;
};

export type WorkspaceArtifact =
  | TableArtifact
  | ChartArtifact
  | FileListArtifact
  | DocumentArtifact
  | DashboardArtifact
  | InvoiceArtifact;
