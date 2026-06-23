const WORKSPACE_ID = "294a8c57-6e10-4437-9e96-58f84353d2ad";
const LEDGER_KEY = "ledger_c6d501d0-b709-47a8-8552-02228069b7b0";
const TARGET_TABLE_ID = "f4d8fa38-9a60-4f5b-837a-3aaa28117a0f";

const history = [
  {
    id: "hist-user-1",
    role: "user",
    type: "text",
    content: "Analyze Rohit Sharma hotel expenses",
    createdAt: "2026-06-23T10:00:00.000Z",
  },
  {
    id: "hist-assistant-1",
    role: "assistant",
    type: "text",
    content: `Spending Breakdown by Category
Category	Amount	% of Total
Room Rent	₹1,800	64.7%
Food & Beverages	₹550	19.8%
Transport	₹350	12.6%
Services	₹50	1.8%
Beverages	₹30	1.1%`,
    createdAt: "2026-06-23T10:01:00.000Z",
  },
];

const form = new FormData();
form.set(
  "content",
  "add this new Entertainment expense of ₹200 to the category spending table from my upload"
);
form.set("history", JSON.stringify(history));
form.set("mode", "default");
form.set("workspaceId", WORKSPACE_ID);
form.set("ledgerKey", LEDGER_KEY);
form.set("targetAssetId", TARGET_TABLE_ID);

const response = await fetch("http://localhost:3000/api/chat", {
  method: "POST",
  body: form,
});

const text = await response.text();
const events = text
  .split("\n\n")
  .filter((chunk) => chunk.startsWith("data: "))
  .map((chunk) => {
    try {
      return JSON.parse(chunk.slice(6));
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const assetUpdated = events.find((event) => event.type === "asset_updated");
const assetCreated = events.filter((event) => event.type === "asset_created");
const errors = events.filter((event) => event.type === "error");

console.log(
  JSON.stringify(
    {
      status: response.status,
      assetUpdated: assetUpdated
        ? {
            id: assetUpdated.asset?.id,
            version: assetUpdated.asset?.version,
            rowCount: assetUpdated.asset?.data?.rows?.length ?? 0,
          }
        : null,
      createdCount: assetCreated.length,
      errors,
      phaseEvents: events.filter((event) => event.type === "phase").map((event) => event.name),
    },
    null,
    2
  )
);
