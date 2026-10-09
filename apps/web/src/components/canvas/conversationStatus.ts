export type InboxStatus = "working" | "waiting" | "unread" | "read" | "needsResponse" | "completed";

export interface ConversationStatusInput {
  readonly sessionStatus?: string | null;
  readonly backgroundLiveness?: "working" | "monitoring" | null;
  readonly snoozedUntil?: string | null;
  readonly hasPendingApprovals: boolean;
  readonly hasPendingUserInput: boolean;
  readonly hasActionableProposedPlan: boolean;
  readonly updatedAt: string;
  readonly lastVisitedAt?: string | null;
  readonly userCompletedAt?: string | null;
  readonly now?: number;
}

const STATUS_LABEL: Record<InboxStatus, string> = {
  working: "Working",
  waiting: "Waiting",
  unread: "Unread",
  read: "Read",
  needsResponse: "Needs response",
  completed: "Completed",
};

export const STATUS_CLASS: Record<InboxStatus, string> = {
  working: "text-sky-600 dark:text-sky-300",
  waiting: "text-amber-600 dark:text-amber-300",
  unread: "text-blue-600 dark:text-blue-300",
  read: "text-muted-foreground",
  needsResponse: "text-violet-600 dark:text-violet-300",
  completed: "text-emerald-600 dark:text-emerald-300",
};

export function statusLabel(status: InboxStatus): string {
  return STATUS_LABEL[status];
}

function time(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function resolveConversationStatus(input: ConversationStatusInput): InboxStatus {
  const now = input.now ?? Date.now();
  const updatedAt = time(input.updatedAt) ?? 0;
  const completedAt = time(input.userCompletedAt);
  if (completedAt !== null && updatedAt <= completedAt) return "completed";

  if (
    input.sessionStatus === "running" ||
    input.sessionStatus === "starting" ||
    input.backgroundLiveness === "working"
  ) {
    return "working";
  }

  const snoozedUntil = time(input.snoozedUntil);
  if (snoozedUntil !== null && snoozedUntil > now) return "waiting";

  const needsUser =
    input.hasPendingApprovals || input.hasPendingUserInput || input.hasActionableProposedPlan;
  const visitedAt = time(input.lastVisitedAt);
  const unread = visitedAt === null || visitedAt < updatedAt;
  if (unread) return "unread";
  if (needsUser) return "needsResponse";
  return "read";
}
