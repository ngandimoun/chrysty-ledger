import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { createMessageId, type ChatMessage, type FileRef } from "@/lib/chat-types";

const RECEIPT_VENDORS = [
  "Amazon",
  "Fuel Station",
  "Office Depot",
  "Whole Foods",
  "Staples",
  "Home Depot",
  "Target",
  "Costco",
  "Uber",
  "Lyft",
];

const BANK_VENDORS = [
  "Payroll Deposit",
  "Rent Payment",
  "Electric Co",
  "Internet Provider",
  "Insurance Premium",
  "Supplier Inc",
  "Client Payment",
  "ATM Withdrawal",
];

function createReceiptTableArtifact(): WorkspaceArtifact {
  const rows = Array.from({ length: 20 }, (_, index) => {
    const day = (index % 28) + 1;
    const vendor = RECEIPT_VENDORS[index % RECEIPT_VENDORS.length];
    const amount = 15 + ((index * 37) % 120);
    return {
      Date: `June ${day}`,
      Vendor: vendor,
      Amount: `$${amount}`,
      Category: index % 3 === 0 ? "Supplies" : index % 3 === 1 ? "Travel" : "Office",
    };
  });

  return {
    id: createMessageId(),
    kind: "table",
    title: "Transactions",
    columns: ["Date", "Vendor", "Amount", "Category"],
    rows,
  };
}

function createExpensesTableArtifact(): WorkspaceArtifact {
  const rows = Array.from({ length: 12 }, (_, index) => {
    const day = (index % 28) + 1;
    const vendor = RECEIPT_VENDORS[index % RECEIPT_VENDORS.length];
    const amount = 20 + ((index * 29) % 90);
    return {
      Date: `June ${day}`,
      Vendor: vendor,
      Amount: `$${amount}`,
      Category: index % 2 === 0 ? "Supplies" : "Office",
    };
  });

  return {
    id: createMessageId(),
    kind: "table",
    title: "Expenses",
    columns: ["Date", "Vendor", "Amount", "Category"],
    rows,
  };
}

function createRevenueTableArtifact(): WorkspaceArtifact {
  const rows = Array.from({ length: 8 }, (_, index) => {
    const day = (index % 28) + 1;
    const amount = 400 + ((index * 97) % 1200);
    return {
      Date: `June ${day}`,
      Source: index % 2 === 0 ? "Walk-in Sales" : "Online Orders",
      Amount: `$${amount}`,
    };
  });

  return {
    id: createMessageId(),
    kind: "table",
    title: "Revenue",
    columns: ["Date", "Source", "Amount"],
    rows,
  };
}

function createBankTableArtifact(): WorkspaceArtifact {
  const rows = Array.from({ length: 15 }, (_, index) => {
    const day = (index % 28) + 1;
    const vendor = BANK_VENDORS[index % BANK_VENDORS.length];
    const isCredit = index % 4 === 0;
    const amount = 50 + ((index * 53) % 800);
    return {
      Date: `June ${day}`,
      Description: vendor,
      Amount: isCredit ? `+$${amount}` : `-$${amount}`,
      Balance: `$${(4200 + index * 120).toLocaleString()}`,
    };
  });

  return {
    id: createMessageId(),
    kind: "table",
    title: "Bank Transactions",
    columns: ["Date", "Description", "Amount", "Balance"],
    rows,
  };
}

function createExpenseChartArtifact(): WorkspaceArtifact {
  return {
    id: createMessageId(),
    kind: "chart",
    title: "Category Breakdown",
    chartType: "bar",
    data: [
      { label: "Supplies", value: 420 },
      { label: "Travel", value: 280 },
      { label: "Office", value: 340 },
      { label: "Marketing", value: 190 },
      { label: "Utilities", value: 150 },
    ],
  };
}

function createMonthlyDashboardArtifact(): WorkspaceArtifact {
  return {
    id: createMessageId(),
    kind: "dashboard",
    title: "Monthly Dashboard",
    kpis: [
      { label: "Revenue", value: "$12,400" },
      { label: "Expenses", value: "$4,100" },
      { label: "Profit", value: "$8,300" },
    ],
    chart: {
      chartType: "bar",
      data: [
        { label: "Week 1", value: 2800 },
        { label: "Week 2", value: 3100 },
        { label: "Week 3", value: 2900 },
        { label: "Week 4", value: 3600 },
      ],
    },
  };
}

function createExpenseAnalysisDocument(): WorkspaceArtifact {
  return {
    id: createMessageId(),
    kind: "document",
    title: "Expense Analysis",
    content: `Expense Analysis — June

Your total expenses this month are $4,100, down 5% from May.

Top categories:
• Supplies — $1,420 (35%)
• Office — $980 (24%)
• Travel — $640 (16%)

Recommendations:
• Consolidate supply orders to reduce shipping costs
• Review recurring subscriptions in the Office category
• Set a monthly cap for travel expenses`,
  };
}

function createJuneReportDocument(): WorkspaceArtifact {
  return {
    id: createMessageId(),
    kind: "document",
    title: "June Report",
    content: `June Business Report

Revenue increased 12% compared to last month.
Expenses decreased 5%.
Profit margin improved to 67%.

Highlights:
• Strong walk-in sales in the second half of the month
• Marketing spend remained flat while conversions rose
• Payroll costs were stable`,
  };
}

function createInvoiceArtifact(): WorkspaceArtifact {
  return {
    id: createMessageId(),
    kind: "invoice",
    title: "Invoice #001",
    invoiceNumber: "001",
    clientName: "Acme Bakery Supply Co.",
    issueDate: "June 1, 2026",
    dueDate: "June 30, 2026",
    lineItems: [
      {
        description: "Custom cake design",
        quantity: 1,
        rate: "$450.00",
        amount: "$450.00",
      },
      {
        description: "Catering — 50 guests",
        quantity: 1,
        rate: "$1,200.00",
        amount: "$1,200.00",
      },
    ],
    total: "$1,650.00",
  };
}

function createTaxExportArtifact(): WorkspaceArtifact {
  return {
    id: createMessageId(),
    kind: "file-list",
    title: "Tax Export",
    files: [
      { name: "Q2-transactions.xlsx", size: "124 KB" },
      { name: "Q2-expense-summary.pdf", size: "86 KB" },
      { name: "tax-category-breakdown.csv", size: "12 KB" },
    ],
  };
}

function createUploadedFilesArtifact(files: FileRef[]): WorkspaceArtifact {
  return {
    id: createMessageId(),
    kind: "file-list",
    title: "Uploaded Files",
    files: files.map((file) => ({
      name: file.name,
      size: formatFileSize(file.size),
    })),
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function now(): string {
  return new Date().toISOString();
}

function textMessage(content: string): ChatMessage {
  return {
    id: createMessageId(),
    role: "assistant",
    type: "text",
    content,
    createdAt: now(),
  };
}

function artifactMessage(summary: string, artifact: WorkspaceArtifact): ChatMessage {
  return {
    id: createMessageId(),
    role: "assistant",
    type: "artifact",
    summary,
    artifact,
    createdAt: now(),
  };
}

function createdMessage(
  content: string,
  artifacts: WorkspaceArtifact[]
): ChatMessage {
  return {
    id: createMessageId(),
    role: "assistant",
    type: "created",
    content,
    assets: artifacts.map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
    })),
    createdAt: now(),
  };
}

export function getArtifactsFromReplies(replies: ChatMessage[]): WorkspaceArtifact[] {
  return replies
    .filter((reply) => reply.type === "artifact")
    .map((reply) => reply.artifact);
}

export function getMockAssistantReplies(
  userContent: string,
  files: FileRef[] = []
): ChatMessage[] {
  const normalized = userContent.toLowerCase().trim();

  if (normalized.includes("analyze") && normalized.includes("expense")) {
    const report = createExpenseAnalysisDocument();
    const chart = createExpenseChartArtifact();
    return [
      createdMessage("I created:", [report, chart]),
      artifactMessage("Expense analysis report.", report),
      artifactMessage("Category breakdown chart.", chart),
    ];
  }

  if (normalized.includes("dashboard") || normalized.includes("monthly")) {
    const dashboard = createMonthlyDashboardArtifact();
    return [
      createdMessage("I created:", [dashboard]),
      artifactMessage("Your monthly business dashboard.", dashboard),
    ];
  }

  if (normalized.includes("june") && normalized.includes("report")) {
    const report = createJuneReportDocument();
    return [
      createdMessage("I created:", [report]),
      artifactMessage("June business report.", report),
    ];
  }

  if (files.length > 0 || normalized.includes("receipt")) {
    const transactions = createReceiptTableArtifact();
    const expenses = createExpensesTableArtifact();
    return [
      textMessage(
        `I found:\n\n• ${files.length > 0 ? files.length : 20} receipts\n• $1,240 in expenses\n• 8 vendors\n\nWould you like me to organize them?`
      ),
      createdMessage("I created:", [transactions, expenses]),
      artifactMessage("Extracted transactions from your receipts.", transactions),
      artifactMessage("Organized expense records.", expenses),
    ];
  }

  if (normalized.includes("bank") || normalized.includes("import")) {
    const artifact = createBankTableArtifact();
    return [
      textMessage(
        "I parsed your bank statement and found 15 transactions across 6 categories."
      ),
      createdMessage("I created:", [artifact]),
      artifactMessage("Here are your imported bank transactions.", artifact),
    ];
  }

  if (
    normalized.includes("expense") ||
    normalized.includes("category") ||
    normalized.includes("track")
  ) {
    const expenses = createExpensesTableArtifact();
    const chart = createExpenseChartArtifact();
    return [
      textMessage("Here's a breakdown of your spending this month."),
      createdMessage("I created:", [expenses, chart]),
      artifactMessage("Expense records by vendor.", expenses),
      artifactMessage("Expenses grouped by category.", chart),
    ];
  }

  if (normalized.includes("revenue")) {
    const revenue = createRevenueTableArtifact();
    return [
      createdMessage("I created:", [revenue]),
      artifactMessage("Revenue records for this month.", revenue),
    ];
  }

  if (normalized.includes("invoice")) {
    const invoice = createInvoiceArtifact();
    return [
      textMessage("I created a draft invoice for your client."),
      createdMessage("I created:", [invoice]),
      artifactMessage("Invoice ready for review.", invoice),
    ];
  }

  if (normalized.includes("export") || normalized.includes("tax")) {
    const exportArtifact = createTaxExportArtifact();
    return [
      textMessage("I prepared your tax export files."),
      createdMessage("I created:", [exportArtifact]),
      artifactMessage("Tax export files are ready.", exportArtifact),
    ];
  }

  if (files.length > 0) {
    const artifact = createUploadedFilesArtifact(files);
    return [
      textMessage(`I received ${files.length} file${files.length === 1 ? "" : "s"}.`),
      createdMessage("I created:", [artifact]),
      artifactMessage("Uploaded files ready for processing.", artifact),
    ];
  }

  return [
    textMessage(
      "I'm here to help with receipts, expenses, invoices, and reports. What would you like to do?"
    ),
  ];
}

export function findArtifactInMessages(
  messages: ChatMessage[],
  artifactId: string
): WorkspaceArtifact | undefined {
  for (const message of messages) {
    if (message.type === "artifact" && message.artifact.id === artifactId) {
      return message.artifact;
    }
  }
  return undefined;
}

export function getArtifactIdsFromReplies(replies: ChatMessage[]): string[] {
  return getArtifactsFromReplies(replies).map((artifact) => artifact.id);
}
