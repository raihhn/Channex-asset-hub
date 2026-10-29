import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  developmentPersonIds,
  requireCanonicalPerson,
} from "@/server/people/canonical";
import type { Person } from "@/types/identity";
import {
  ActorResolutionError,
  type ActorAdapter,
  type ServerActorContext,
} from "./actor-context";
import { hasOnlyLoopbackListener } from "./loopback-listener";

export const LOCAL_ACTOR_COOKIE = "assethub_local_actor";
const lifetime = 60 * 60;
// Explicit allowlist: adding a Person fixture does not silently enable selection.
const developmentPeople = new Set<string>(developmentPersonIds);
const keySymbol = Symbol.for("assethub.local-actor.m1b.key");
const runtime = globalThis as typeof globalThis & { [keySymbol]?: Buffer };
// Separate ephemeral key; never read ASSETHUB_MEDIA_SIGNING_KEY. Restart revokes sessions.
const key = (runtime[keySymbol] ??= randomBytes(32));

export async function requireLocalActorBoundary(
  request: Request,
): Promise<URL> {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.ASSETHUB_ACTOR_MODE !== "local-development"
  ) {
    throw new ActorResolutionError(404, "LOCAL_ACTOR_DISABLED");
  }
  let url: URL;
  let configured: URL;
  try {
    url = new URL(request.url);
    configured = new URL(process.env.ASSETHUB_LOCAL_ACTOR_ORIGIN ?? "");
  } catch {
    throw new ActorResolutionError(503, "LOCAL_ORIGIN_UNCONFIGURED");
  }
  const port = Number(
    configured.port || (configured.protocol === "https:" ? 443 : 80),
  );
  // NextURL normalizes loopback IP hostnames to localhost, including request.url.
  // Accept only that representation of the configured origin. Host, Origin,
  // forwarding consistency and the actual listener must still match exactly.
  const normalizedOrigin = new URL(configured.origin);
  if (["127.0.0.1", "[::1]"].includes(normalizedOrigin.hostname)) {
    normalizedOrigin.hostname = "localhost";
  }
  // Next 16 synthesizes this tuple even for direct requests (base-server.js).
  // It is only a consistency check; the OS listener check supplies locality.
  const forwarded = [
    "x-forwarded-host",
    "x-forwarded-port",
    "x-forwarded-proto",
    "x-forwarded-for",
  ];
  const hasForwarding = forwarded.some((name) => request.headers.has(name));
  const invalidForwarding =
    hasForwarding &&
    (request.headers.get("x-forwarded-host") !== configured.host ||
      request.headers.get("x-forwarded-port") !== String(port) ||
      request.headers.get("x-forwarded-proto") !==
        configured.protocol.slice(0, -1) ||
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        request.headers.get("x-forwarded-for") ?? "",
      ));
  if (
    !["http:", "https:"].includes(configured.protocol) ||
    !["127.0.0.1", "[::1]", "localhost"].includes(configured.hostname) ||
    configured.username ||
    configured.password ||
    configured.pathname !== "/" ||
    configured.search ||
    configured.hash ||
    (url.origin !== configured.origin &&
      url.origin !== normalizedOrigin.origin) ||
    request.headers.get("host") !== configured.host ||
    [...request.headers.keys()].some(
      (name) =>
        name === "forwarded" ||
        (name.startsWith("x-forwarded-") && !forwarded.includes(name)),
    ) ||
    invalidForwarding ||
    (request.headers.has("origin") &&
      request.headers.get("origin") !== configured.origin) ||
    (request.headers.has("sec-fetch-site") &&
      request.headers.get("sec-fetch-site") !== "same-origin")
  ) {
    throw new ActorResolutionError(403, "LOCAL_ORIGIN_REJECTED");
  }
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== configured.origin
  ) {
    throw new ActorResolutionError(403, "LOCAL_ORIGIN_REQUIRED");
  }
  if (!(await hasOnlyLoopbackListener(port)))
    throw new ActorResolutionError(503, "LOOPBACK_LISTENER_UNVERIFIED");
  return configured;
}

async function person(id: string): Promise<Person> {
  if (!developmentPeople.has(id))
    throw new ActorResolutionError(401, "LOCAL_PERSON_UNAVAILABLE");
  return requireCanonicalPerson(id);
}
async function context(id: string): Promise<ServerActorContext> {
  return {
    identity: {
      subject: `local-development:${id}`,
      source: "local-development",
      providerVerified: false,
    },
    person: await person(id),
    capabilities: ["asset:read", "request:create"],
  };
}
function signature(payload: string): Buffer {
  return createHmac("sha256", key)
    .update(`assethub-local-actor-v1.${payload}`)
    .digest();
}

export async function selectLocalActor(request: Request): Promise<Response> {
  const origin = await requireLocalActorBoundary(request);
  if (request.method !== "POST")
    throw new ActorResolutionError(403, "POST_REQUIRED");
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  ) {
    throw new ActorResolutionError(403, "JSON_REQUIRED");
  }
  // Small payload only; never accept roles, scopes or capabilities as authority.
  const body = await request.text();
  if (body.length > 512)
    throw new ActorResolutionError(403, "INVALID_SELECTION");
  let selection: unknown;
  try {
    selection = JSON.parse(body);
  } catch {
    throw new ActorResolutionError(403, "INVALID_SELECTION");
  }
  if (
    !selection ||
    typeof selection !== "object" ||
    Object.keys(selection).length !== 1 ||
    !("personId" in selection) ||
    typeof selection.personId !== "string"
  ) {
    throw new ActorResolutionError(403, "INVALID_SELECTION");
  }
  const actor = await context(selection.personId);
  const issued = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      sub: actor.person.id,
      iat: issued,
      exp: issued + lifetime,
      aud: origin.origin,
    }),
  ).toString("base64url");
  const token = `${payload}.${signature(payload).toString("base64url")}`;
  return Response.json(projectActor(actor), {
    headers: {
      "Cache-Control": "no-store",
      Vary: "Cookie, Origin",
      "Set-Cookie": `${LOCAL_ACTOR_COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${lifetime}; Expires=${new Date((issued + lifetime) * 1000).toUTCString()}${origin.protocol === "https:" ? "; Secure" : ""}`,
    },
  });
}

export async function resolveLocalActor(
  request: Request,
): Promise<ServerActorContext> {
  const origin = await requireLocalActorBoundary(request);
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(`${LOCAL_ACTOR_COOKIE}=`));
  if (values.length !== 1)
    throw new ActorResolutionError(401, "LOCAL_SESSION_REQUIRED");
  const token = values[0].slice(LOCAL_ACTOR_COOKIE.length + 1);
  if (token.length > 2048)
    throw new ActorResolutionError(401, "LOCAL_SESSION_INVALID");
  const parts = token.split(".");
  if (parts.length !== 2 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p)))
    throw new ActorResolutionError(401, "LOCAL_SESSION_INVALID");
  const expected = signature(parts[0]);
  const supplied = Buffer.from(parts[1], "base64url");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new ActorResolutionError(401, "LOCAL_SESSION_INVALID");
  try {
    const value = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    );
    const now = Math.floor(Date.now() / 1000);
    if (
      value.v !== 1 ||
      typeof value.sub !== "string" ||
      value.aud !== origin.origin ||
      !Number.isSafeInteger(value.iat) ||
      !Number.isSafeInteger(value.exp) ||
      value.iat > now ||
      value.exp <= now ||
      value.exp - value.iat !== lifetime
    )
      throw new Error();
    return await context(value.sub);
  } catch {
    throw new ActorResolutionError(401, "LOCAL_SESSION_INVALID");
  }
}

/** Minimal projection: no email, PIC contacts, scopes or role-derived grants. */
export function projectActor(actor: ServerActorContext) {
  return {
    identity: actor.identity,
    person: { id: actor.person.id, name: actor.person.name },
    capabilities: actor.capabilities,
  };
}

export const localDevelopmentActorAdapter: ActorAdapter = {
  resolve: resolveLocalActor,
};
