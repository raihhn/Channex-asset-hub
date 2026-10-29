import { selectLocalActor } from "@/server/auth/local-actor";
import { actorErrorResponse } from "@/server/auth/resolve-actor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return await selectLocalActor(request);
  } catch (error) {
    return actorErrorResponse(error);
  }
}

/** Local selector bootstrap only; no session or account is created by reading choices. */
export async function GET(request: Request) {
  try {
    const { requireLocalActorBoundary } =
      await import("@/server/auth/local-actor");
    const { canonicalPersonChoices } =
      await import("@/server/people/canonical");
    await requireLocalActorBoundary(request);
    return Response.json(await canonicalPersonChoices(true), {
      headers: { "Cache-Control": "no-store", Vary: "Cookie, Origin" },
    });
  } catch (error) {
    return actorErrorResponse(error);
  }
}
