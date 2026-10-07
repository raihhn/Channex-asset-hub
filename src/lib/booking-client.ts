import type { AuditEvent } from "@/types/identity";
import type { ApprovalAssignment, ApprovalDecision, PrototypeRequest, RequestDraft, WbsReference } from "@/types/prototype";

export const durableBookingEnabled = process.env.NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED === "true";

export class BookingClientError extends Error {
  constructor(public code: string, message: string, public assetId?: string) {
    super(message);
    this.name = "BookingClientError";
  }
}

async function decode<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string; message?: string; assetId?: string };
  if (!response.ok) throw new BookingClientError(body.code ?? "UNEXPECTED", body.message ?? "Could not save this Request.", body.assetId);
  return body;
}

export async function fetchDurableBookings(): Promise<{ requests: PrototypeRequest[]; wbsReferences: WbsReference[]; assignments: ApprovalAssignment[]; auditEvents: AuditEvent[] }> {
  return decode(await fetch("/api/booking/requests", { cache: "no-store" }));
}

export async function saveDurableBooking(draft: RequestDraft, actorId: string, commandKey: string, revision?: PrototypeRequest): Promise<PrototypeRequest> {
  const url = revision ? `/api/booking/requests/${encodeURIComponent(revision.id)}` : "/api/booking/requests";
  return decode(await fetch(url, {
    method: revision ? "PATCH" : "POST",
    headers: { "content-type": "application/json", "x-prototype-actor-id": actorId },
    body: JSON.stringify(revision ? { draft, commandKey, expectedVersion: revision.version } : { draft, commandKey }),
  }));
}

export async function saveDurableReview(request: PrototypeRequest, actorId: string, command: { action: "assign"; reviewerId: string } | { action: "decide"; decision: ApprovalDecision; note: string }) {
  return decode<Awaited<ReturnType<typeof fetchDurableBookings>>>(await fetch(`/api/booking/requests/${encodeURIComponent(request.id)}/review`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-prototype-actor-id": actorId },
    body: JSON.stringify({ ...command, expectedVersion: request.version }),
  }));
}
