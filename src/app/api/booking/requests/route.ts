import { bookingConfigured, BookingError, loadBookings, prototypeActor, submitBooking } from "@/lib/server/booking";
import type { RequestDraft } from "@/types/prototype";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof BookingError) return Response.json({ code: error.code, message: error.message, assetId: error.assetId }, { status: error.code === "CONFLICT" || error.code === "STALE" ? 409 : error.code === "NOT_FOUND" ? 404 : error.code === "DISABLED" ? 503 : 400 });
  console.error("Booking command failed", error);
  return Response.json({ code: "UNEXPECTED", message: "Could not save this Request. Try again." }, { status: 500 });
}

export async function GET() {
  if (!bookingConfigured()) return Response.json({ code: "DISABLED", message: "Durable booking is not configured." }, { status: 503 });
  try { return Response.json(await loadBookings()); } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  if (!bookingConfigured()) return Response.json({ code: "DISABLED", message: "Durable booking is not configured." }, { status: 503 });
  try {
    const body = await request.json() as { draft?: RequestDraft; commandKey?: string };
    if (!body.draft || !Array.isArray(body.draft.items) || typeof body.commandKey !== "string") throw new BookingError("VALIDATION", "Invalid Request payload.");
    const actor = prototypeActor(request.headers.get("x-prototype-actor-id"));
    const saved = await submitBooking(body.draft, actor, body.commandKey);
    return Response.json(saved, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
