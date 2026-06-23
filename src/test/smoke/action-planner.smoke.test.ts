import { describe, expect, it } from "vitest";

import { resolveActionPlan } from "@/lib/agent-actions/action-planner";

describe("ActionPlanner fallback", () => {
  it("plans import for attachments without API", async () => {
    const plan = await resolveActionPlan({
      userInput: "import my bank statement",
      attachmentCount: 1,
      attachmentTypes: ["text/csv"],
      mode: "default",
      assetCount: 0,
      assetKinds: [],
    });
    expect(plan.actions[0]?.action).toBe("import");
    expect(plan.userFacingPhase.length).toBeGreaterThan(0);
  });

  it("plans conversational create for empty prompts without attachments", async () => {
    const plan = await resolveActionPlan({
      userInput: "bonjour",
      attachmentCount: 0,
      attachmentTypes: [],
      mode: "default",
      assetCount: 0,
      assetKinds: [],
    });
    expect(plan.actions.length).toBeGreaterThan(0);
  });
});
