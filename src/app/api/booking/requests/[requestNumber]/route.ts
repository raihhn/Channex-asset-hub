import { bookingConfigured, BookingError, loadBooking, prototypeActor, resubmitBooking } from "@/lib/server/booking";
import type { RequestDraft } from "@/types/prototype";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/booking/requests/[requestNumber]">) {
  if (!bookingConfigured()) return Response.json({ code: "DISABLED" }, { status: 503 });
  try {
    const { requestNumber } = await context.params;
    const result = await loadBooking(requestNumber);
    return result ? Response.json(result) : Response.json({ code: "NOT_FOUND" }, { status: 404 });
  } catch (error) {
    console.error("Booking read failed", error);
    return Response.json({ code: "UNEXPECTED" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/booking/requests/[requestNumber]">) {
  if (!bookingConfigured()) return Response.json({ code: "DISABLED" }, { status: 503 });
  try {
    const { requestNumber } = await context.params;
    const body = await request.json() as { draft?: RequestDraft; expectedVersion?: number; commandKey?: string };
    if (!body.draft || !Array.isArray(body.draft.items) || !Number.isInteger(body.expectedVersion) || typeof body.commandKey !== "string") throw new BookingError("VALIDATION", "Invalid revision payload.");
    const saved = await resubmitBooking(requestNumber, body.draft, prototypeActor(request.headers.get("x-prototype-actor-id")), body.expectedVersion!, body.commandKey);
    return Response.json(saved);
  } catch (error) {
    if (error instanceof BookingError) return Response.json({ code: error.code, message: error.message, assetId: error.assetId }, { status: error.code === "CONFLICT" || error.code === "STALE" ? 409 : error.code === "NOT_FOUND" ? 404 : 400 });
    console.error("Booking resubmit failed", error);
    return Response.json({ code: "UNEXPECTED", message: "Could not resubmit this Request." }, { status: 500 });
  }
}
