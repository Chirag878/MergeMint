import type { clarificationQuestions, prds } from "@veriflow/db";

export function normalizeDbTimestamp(
  value: Date | string | null | undefined
): Date {
  const date = value instanceof Date ? value : new Date(value ?? "");

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp for stale PRD check");
  }

  return date;
}

export function isClarificationAnswerNewerThanPrd(
  question: Pick<typeof clarificationQuestions.$inferSelect, "answeredAt">,
  prd: Pick<typeof prds.$inferSelect, "createdAt">
) {
  if (!question.answeredAt) {
    return false;
  }

  return (
    normalizeDbTimestamp(question.answeredAt).getTime() >
    normalizeDbTimestamp(prd.createdAt).getTime()
  );
}

export function hasClarificationAnswerChangedAfterPrd(
  clarifications: Array<Pick<typeof clarificationQuestions.$inferSelect, "answeredAt">>,
  prd: Pick<typeof prds.$inferSelect, "createdAt"> | null | undefined
) {
  if (!prd) {
    return false;
  }

  return clarifications.some((question) =>
    isClarificationAnswerNewerThanPrd(question, prd)
  );
}

