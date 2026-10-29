import {
  resolveServerActor,
  actorErrorResponse,
} from "@/server/auth/resolve-actor";
import { canonicalPersonChoices } from "@/server/people/canonical";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await resolveServerActor(request);
    return Response.json(
      (await canonicalPersonChoices(false)).filter(
        (person) => !person.roles.includes("VENDOR"),
      ),
      { headers: { "Cache-Control": "no-store", Vary: "Cookie, Origin" } },
    );
  } catch (error) {
    return actorErrorResponse(error);
  }
}
