import { describe, expect, it } from "vite-plus/test";

import { resolveConversationStatus } from "./conversationStatus";

const base = {
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  hasActionableProposedPlan: false,
  updatedAt: "2026-10-09T12:00:00.000Z",
  lastVisitedAt: "2026-10-09T12:00:00.000Z",
  now: Date.parse("2026-10-09T13:00:00.000Z"),
};

describe("resolveConversationStatus", () => {
  it("keeps a completed card completed until newer activity arrives", () => {
    expect(
      resolveConversationStatus({
        ...base,
        userCompletedAt: "2026-10-09T12:30:00.000Z",
      }),
    ).toBe("completed");
    expect(
      resolveConversationStatus({
        ...base,
        updatedAt: "2026-10-09T12:45:00.000Z",
        userCompletedAt: "2026-10-09T12:30:00.000Z",
      }),
    ).toBe("unread");
  });

  it("ranks working above a snooze and unread above a pending reply", () => {
    expect(
      resolveConversationStatus({
        ...base,
        sessionStatus: "running",
        snoozedUntil: "2026-10-09T18:00:00.000Z",
      }),
    ).toBe("working");
    expect(
      resolveConversationStatus({
        ...base,
        lastVisitedAt: "2026-10-09T11:00:00.000Z",
        hasPendingUserInput: true,
      }),
    ).toBe("unread");
    expect(
      resolveConversationStatus({
        ...base,
        hasPendingApprovals: true,
      }),
    ).toBe("needsResponse");
  });
});
