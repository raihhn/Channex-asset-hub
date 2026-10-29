import {
  resolveServerActor,
  actorErrorResponse,
} from "@/server/auth/resolve-actor";
import { ActorResolutionError } from "@/server/auth/actor-context";
import {
  bookingConfigured,
  BookingError,
  loadBooking,
  resubmitBooking,
} from "@/lib/server/booking";
import type { RequestDraft } from "@/types/prototype";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: RouteContext<"/api/booking/requests/[requestNumber]">,
) {
  if (!bookingConfigured())
    return Response.json({ code: "DISABLED" }, { status: 503 });
  try {
    const { requestNumber } = await context.params;
    await resolveServerActor(request);
    const result = await loadBooking(requestNumber);
    return result
      ? Response.json(result)
      : Response.json({ code: "NOT_FOUND" }, { status: 404 });
  } catch (error) {
    if (error instanceof ActorResolutionError) return actorErrorResponse(error);
    console.error("Booking read failed", error);
    return Response.json({ code: "UNEXPECTED" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/booking/requests/[requestNumber]">,
) {
  if (!bookingConfigured())
    return Response.json({ code: "DISABLED" }, { status: 503 });
  try {
    const { requestNumber } = await context.params;
    const body = (await request.json()) as {
      draft?: RequestDraft;
      expectedVersion?: number;
      commandKey?: string;
    };
    if (
      !body.draft ||
      !Array.isArray(body.draft.items) ||
      !Number.isInteger(body.expectedVersion) ||
      typeof body.commandKey !== "string"
    )
      throw new BookingError("VALIDATION", "Invalid revision payload.");
    const saved = await resubmitBooking(
      requestNumber,
      body.draft,
      (await resolveServerActor(request)).person,
      body.expectedVersion!,
      body.commandKey,
    );
    return Response.json(saved);
  } catch (error) {
    if (error instanceof ActorResolutionError) return actorErrorResponse(error);
    if (error instanceof BookingError)
      return Response.json(
        { code: error.code, message: error.message, assetId: error.assetId },
        {
          status:
            error.code === "CONFLICT" || error.code === "STALE"
              ? 409
              : error.code === "NOT_FOUND"
                ? 404
                : 400,
        },
      );
    console.error("Booking resubmit failed", error);
    return Response.json(
      { code: "UNEXPECTED", message: "Could not resubmit this Request." },
      { status: 500 },
    );
  }
}
