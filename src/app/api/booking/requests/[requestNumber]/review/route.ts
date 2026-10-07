import { assignBookingReviewer, bookingConfigured, BookingError, decideBookingReview, prototypeActor } from "@/lib/server/booking";
import type { ApprovalDecision } from "@/types/prototype";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/booking/requests/[requestNumber]/review">) {
  if (!bookingConfigured()) return Response.json({ code: "DISABLED", message: "Durable booking is not configured." }, { status: 503 });
  try {
    const { requestNumber } = await context.params;
    const body = await request.json() as { action?: string; reviewerId?: string; decision?: ApprovalDecision; note?: string; expectedVersion?: number };
    if (!Number.isInteger(body.expectedVersion)) throw new BookingError("VALIDATION", "A Request version is required.");
    const actor = prototypeActor(request.headers.get("x-prototype-actor-id"));
    if (body.action === "assign" && typeof body.reviewerId === "string") return Response.json(await assignBookingReviewer(requestNumber, body.reviewerId, actor, body.expectedVersion!));
    if (body.action === "decide" && typeof body.decision === "string" && typeof body.note === "string") return Response.json(await decideBookingReview(requestNumber, body.decision, body.note, actor, body.expectedVersion!));
    throw new BookingError("VALIDATION", "Invalid review command.");
  } catch (error) {
    if (error instanceof BookingError) return Response.json({ code: error.code, message: error.message }, { status: error.code === "STALE" ? 409 : error.code === "NOT_FOUND" ? 404 : 400 });
    console.error("Booking review failed", error);
    return Response.json({ code: "UNEXPECTED", message: "Could not save this review." }, { status: 500 });
  }
}
