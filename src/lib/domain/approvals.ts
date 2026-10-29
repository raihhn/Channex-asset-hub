import type { Person } from "@/types/identity";
import type { ApprovalAssignment, ApprovalDecision, PrototypeRequest, RequestReviewHistoryEntry } from "@/types/prototype";

export function activeReviewAssignment(assignments: ApprovalAssignment[], requestId: string) {
  return assignments.find((item) => item.requestId === requestId && item.status === "Pending");
}

export function reviewCycle(request: PrototypeRequest) {
  return request.reviewRound ?? 1;
}

export function isAssignableReviewer(person: Person | undefined) {
  return Boolean(person && person.status === "ACTIVE" && !person.roles.includes("VENDOR"));
}

export function validateReviewerAssignment(request: PrototypeRequest | undefined, reviewer: Person | undefined, actor: Person, assignments: ApprovalAssignment[]) {
  if (!request) throw new Error("Request not found.");
  if (request.status !== "Pending approval") throw new Error("Only a pending Request can receive a reviewer.");
  if (!actor.roles.includes("SUPER_ADMIN")) throw new Error("Only the prototype Super Admin can assign a reviewer.");
  if (!isAssignableReviewer(reviewer)) throw new Error("Choose an active internal Person.");
  if (request.submittedByUserId && request.submittedByUserId === reviewer!.id) throw new Error("A requester cannot review their own Request.");
  const active = activeReviewAssignment(assignments, request.id);
  if (active?.reviewerUserId === reviewer!.id) throw new Error("This reviewer is already assigned.");
  return active;
}

export function validateReviewDecision(request: PrototypeRequest | undefined, assignment: ApprovalAssignment | undefined, actor: Person, decision: ApprovalDecision, note: string) {
  if (!request || request.status !== "Pending approval") throw new Error("Only a pending Request can be reviewed.");
  if (!assignment || assignment.status !== "Pending" || assignment.cycle !== reviewCycle(request)) throw new Error("An active review assignment is required.");
  if (actor.id !== assignment.reviewerUserId) throw new Error("Switch to the assigned reviewer to decide. No admin override is enabled.");
  if (decision !== "Approved" && !note.trim()) throw new Error(`${decision} requires a reason.`);
}

export function reviewHistoryEntry(input: Omit<RequestReviewHistoryEntry, "id" | "actorUserId" | "actorNameSnapshot"> & { actor: Person }): RequestReviewHistoryEntry {
  const { actor, ...rest } = input;
  return { ...rest, id: `review-event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, actorUserId: actor.id, actorNameSnapshot: actor.name };
}

export function appendReviewHistory(request: PrototypeRequest, entry: RequestReviewHistoryEntry): PrototypeRequest {
  return { ...request, reviewHistory: [...(request.reviewHistory ?? []), entry] };
}
