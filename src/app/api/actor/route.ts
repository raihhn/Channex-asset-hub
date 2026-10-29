import { projectActor } from "@/server/auth/local-actor";
import {
  resolveServerActor,
  actorErrorResponse,
} from "@/server/auth/resolve-actor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return Response.json(projectActor(await resolveServerActor(request)), {
      headers: { "Cache-Control": "no-store", Vary: "Cookie, Origin" },
    });
  } catch (error) {
    return actorErrorResponse(error);
  }
}
