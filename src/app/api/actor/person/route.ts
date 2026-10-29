import {
  resolveServerActor,
  actorErrorResponse,
} from "@/server/auth/resolve-actor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Own profile only; no People administration or identity-link projection. */
export async function GET(request: Request) {
  try {
    return Response.json((await resolveServerActor(request)).person, {
      headers: { "Cache-Control": "no-store", Vary: "Cookie, Origin" },
    });
  } catch (error) {
    return actorErrorResponse(error);
  }
}
