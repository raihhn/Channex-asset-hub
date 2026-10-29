import "server-only";
import { ActorResolutionError, type ServerActorContext } from "./actor-context";
import { localDevelopmentActorAdapter } from "./local-actor";

/** Provider-independent entry point. No prototype-header or default-admin fallback. */
export async function resolveServerActor(
  request: Request,
): Promise<ServerActorContext> {
  if (process.env.ASSETHUB_ACTOR_MODE === "provider") {
    // A future verified provider adapter requires separate approval and explicit mapping.
    throw new ActorResolutionError(503, "PROVIDER_UNCONFIGURED");
  }
  return localDevelopmentActorAdapter.resolve(request);
}

export function actorErrorResponse(error: unknown): Response {
  const known = error instanceof ActorResolutionError;
  return Response.json(
    { error: { code: known ? error.code : "ACTOR_UNAVAILABLE" } },
    {
      status: known ? error.status : 503,
      headers: { "Cache-Control": "no-store", Vary: "Cookie, Origin" },
    },
  );
}
