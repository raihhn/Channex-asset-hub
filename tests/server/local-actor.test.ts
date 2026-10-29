import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { peopleFixtures } from "@/lib/fixtures/people";
import { LOCAL_ACTOR_COOKIE } from "@/server/auth/local-actor";
import { resolveServerActor } from "@/server/auth/resolve-actor";
import { POST } from "@/app/api/development/session/route";
import { GET } from "@/app/api/actor/route";
import { getCurrentSession, getCurrentUser } from "@/server/auth/session";
import { hasCapability } from "@/server/authorization/capabilities";
import { unresolvedCommandPolicy } from "@/server/authorization/command-policy";

vi.mock("server-only", () => ({}));
const ingress = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock("@/server/auth/loopback-listener", () => ({
  hasOnlyLoopbackListener: ingress.check,
}));
// Changes to status below affect isolated copies, never the canonical fixture module.
vi.mock("@/lib/fixtures/people", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fixtures/people")>();
  return { ...actual, peopleFixtures: structuredClone(actual.peopleFixtures) };
});
const origin = "http://localhost:4301";
function req(
  path: string,
  options: {
    method?: string;
    cookie?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
) {
  const method = options.method ?? "GET";
  return new Request(`${origin}${path}`, {
    method,
    headers: {
      host: "localhost:4301",
      origin,
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
}
async function selection(personId = "user-brand") {
  const response = await POST(
    req("/api/development/session", { method: "POST", body: { personId } }),
  );
  expect(response.status).toBe(200);
  return {
    response,
    cookie: response.headers.get("set-cookie")!.split(";")[0],
  };
}
function signed(payload: unknown, keyOverride?: Buffer) {
  // White-box malformed-claim tests require a valid signature; no key is exposed by HTTP.
  const runtime = globalThis as unknown as Record<symbol, Buffer>;
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac(
    "sha256",
    keyOverride ?? runtime[Symbol.for("assethub.local-actor.m1b.key")],
  )
    .update(`assethub-local-actor-v1.${encoded}`)
    .digest("base64url");
  return `${LOCAL_ACTOR_COOKIE}=${encoded}.${mac}`;
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("ASSETHUB_ACTOR_MODE", "local-development");
  vi.stubEnv("ASSETHUB_LOCAL_ACTOR_ORIGIN", origin);
  ingress.check.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("M1-B local identity boundary", () => {
  it.each(["http://127.0.0.1:4317", "http://[::1]:4317"])(
    "accepts NextRequest loopback normalization while requiring exact transport origin %s",
    async (trustedOrigin) => {
      vi.stubEnv("ASSETHUB_LOCAL_ACTOR_ORIGIN", trustedOrigin);
      const configured = new URL(trustedOrigin);
      const headers = {
        host: configured.host,
        origin: trustedOrigin,
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
        "x-forwarded-host": configured.host,
        "x-forwarded-port": configured.port,
        "x-forwarded-proto": "http",
        "x-forwarded-for": "127.0.0.1",
      };
      const selectionRequest = () =>
        new NextRequest(`${trustedOrigin}/api/development/session`, {
          method: "POST",
          headers,
          body: JSON.stringify({ personId: "user-brand" }),
        });
      expect(selectionRequest().nextUrl.origin).toBe("http://localhost:4317");
      expect(new URL(selectionRequest().url).origin).toBe(
        "http://localhost:4317",
      );
      const response = await POST(selectionRequest());
      expect(response.status).toBe(200);
      const cookie = response.headers.get("set-cookie")!.split(";")[0];
      const current = () =>
        new NextRequest(`${trustedOrigin}/api/actor`, {
          headers: { ...headers, cookie },
        });
      expect((await GET(current())).status).toBe(200);
      for (const override of [
        { origin: "http://localhost:4317" },
        { host: "localhost:4317" },
        { "x-forwarded-host": "localhost:4317" },
        { "x-forwarded-port": "4318" },
      ]) {
        const rejected = new NextRequest(`${trustedOrigin}/api/actor`, {
          headers: { ...headers, cookie, ...override },
        });
        expect((await GET(rejected)).status).toBe(403);
      }
      const wrongPort = new NextRequest("http://localhost:4318/api/actor", {
        headers: { ...headers, cookie },
      });
      expect((await GET(wrongPort)).status).toBe(403);
      ingress.check.mockResolvedValue(false);
      expect((await GET(current())).status).toBe(503);
    },
  );
  it.each([
    "dev-user",
    "user-storedev",
    "user-brand",
    "user-vendor",
    "user-management",
  ])(
    "selects only explicit development identity %s with no role-derived capabilities",
    async (id) => {
      const { response, cookie } = await selection(id);
      expect(response.headers.get("set-cookie")).toContain(
        "HttpOnly; SameSite=Strict; Max-Age=3600",
      );
      expect(response.headers.get("set-cookie")).toContain("Path=/api");
      expect(response.headers.get("set-cookie")).not.toContain("Domain=");
      expect(response.headers.get("set-cookie")).toContain("Expires=");
      const actor = await resolveServerActor(req("/api/actor", { cookie }));
      expect(actor.identity).toEqual({
        subject: `local-development:${id}`,
        source: "local-development",
        providerVerified: false,
      });
      expect(actor.person.id).toBe(id);
      expect(actor.capabilities).toEqual(["asset:read", "request:create"]);
      const projected = await GET(req("/api/actor", { cookie }));
      expect(projected.status).toBe(200);
      expect(projected.headers.get("cache-control")).toBe("no-store");
      const body = await projected.json();
      expect(Object.keys(body.person).sort()).toEqual(["id", "name"]);
      expect(JSON.stringify(body)).not.toMatch(
        /email|vendorId|brandIds|roles|PIC/,
      );
      expect(ingress.check).toHaveBeenCalledWith(4301);
    },
  );
  it("ignores forged actor, role and capability headers when resolving a valid cookie", async () => {
    const { cookie } = await selection();
    const actor = await resolveServerActor(
      req("/api/actor", {
        cookie,
        headers: {
          "x-prototype-actor-id": "dev-user",
          "x-role": "SUPER_ADMIN",
          "x-capabilities": "master-data:manage",
        },
      }),
    );
    expect(actor.person.id).toBe("user-brand");
    expect(actor.capabilities).not.toContain("master-data:manage");
  });
  it("accepts the consistent Next-synthesized forwarding tuple without trusting it as identity or locality", async () => {
    const { cookie } = await selection();
    const headers = {
      "x-forwarded-host": "localhost:4301",
      "x-forwarded-port": "4301",
      "x-forwarded-proto": "http",
      "x-forwarded-for": "127.0.0.1",
    };
    expect((await GET(req("/api/actor", { cookie, headers }))).status).toBe(
      200,
    );
    expect(
      (
        await GET(
          req("/api/actor", {
            cookie,
            headers: { ...headers, "x-forwarded-for": "192.168.1.10" },
          }),
        )
      ).status,
    ).toBe(403);
    ingress.check.mockResolvedValue(false);
    expect((await GET(req("/api/actor", { cookie, headers }))).status).toBe(
      503,
    );
  });
  it("never resolves a header-only actor or silently falls back to admin", async () => {
    const response = await GET(
      req("/api/actor", { headers: { "x-prototype-actor-id": "dev-user" } }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "LOCAL_SESSION_REQUIRED" },
    });
  });
  it("never treats even signed role/scope/capability claims as authority", async () => {
    const iat = Math.floor(Date.now() / 1000);
    const cookie = signed({
      v: 1,
      sub: "user-brand",
      iat,
      exp: iat + 3600,
      aud: origin,
      roles: ["SUPER_ADMIN"],
      capabilities: ["master-data:manage"],
      areaIds: ["all"],
    });
    const actor = await resolveServerActor(req("/api/actor", { cookie }));
    expect(actor.person.roles).toEqual(["BRAND"]);
    expect(actor.person.areaIds).toEqual([]);
    expect(actor.capabilities).toEqual(["asset:read", "request:create"]);
  });
  it("rejects tokens forged with the media signing key", async () => {
    const mediaKey = "isolated-test-media-key-not-an-actor-key";
    vi.stubEnv("ASSETHUB_MEDIA_SIGNING_KEY", mediaKey);
    const iat = Math.floor(Date.now() / 1000);
    const cookie = signed(
      { v: 1, sub: "dev-user", iat, exp: iat + 3600, aud: origin },
      Buffer.from(mediaKey),
    );
    expect((await GET(req("/api/actor", { cookie }))).status).toBe(401);
  });
  it.each([
    {},
    { personId: "unknown" },
    { personId: "user-brand", roles: ["SUPER_ADMIN"] },
    { personId: "user-brand", capabilities: ["master-data:manage"] },
    { personId: 7 },
  ])("rejects invalid selection %j", async (body) => {
    const response = await POST(
      req("/api/development/session", { method: "POST", body }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it("rechecks active state at selection and resolution", async () => {
    const { cookie } = await selection();
    const person = peopleFixtures.find((p) => p.id === "user-brand")!;
    try {
      person.status = "INACTIVE";
      expect(
        (
          await POST(
            req("/api/development/session", {
              method: "POST",
              body: { personId: person.id },
            }),
          )
        ).status,
      ).toBe(401);
      expect((await GET(req("/api/actor", { cookie }))).status).toBe(401);
    } finally {
      person.status = "ACTIVE";
    }
  });
  it("does not automatically allowlist new fixtures", async () => {
    peopleFixtures.push({
      ...structuredClone(peopleFixtures[0]),
      id: "new-admin",
    });
    try {
      expect(
        (
          await POST(
            req("/api/development/session", {
              method: "POST",
              body: { personId: "new-admin" },
            }),
          )
        ).status,
      ).toBe(401);
    } finally {
      peopleFixtures.pop();
    }
  });
  it.each(["", "fake", "abc.def", "a.b.c", "%.%"])(
    "rejects malformed/forged token %j",
    async (token) => {
      expect(
        (
          await GET(
            req("/api/actor", { cookie: `${LOCAL_ACTOR_COOKIE}=${token}` }),
          )
        ).status,
      ).toBe(401);
    },
  );
  it("rejects a changed payload and duplicate session cookies", async () => {
    const { cookie } = await selection();
    const [nameAndPayload, mac] = cookie.split(".");
    expect(
      (await GET(req("/api/actor", { cookie: `${nameAndPayload}x.${mac}` })))
        .status,
    ).toBe(401);
    expect(
      (await GET(req("/api/actor", { cookie: `${cookie}; ${cookie}` }))).status,
    ).toBe(401);
  });
  it("expires at one hour without renewing on reads", async () => {
    vi.useFakeTimers();
    const { cookie } = await selection();
    vi.advanceTimersByTime(3599 * 1000);
    expect((await GET(req("/api/actor", { cookie }))).status).toBe(200);
    vi.advanceTimersByTime(1000);
    const response = await GET(req("/api/actor", { cookie }));
    expect(response.status).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it.each([
    { iat: 9999999999 },
    { exp: 9999999999 },
    { aud: "http://localhost:9999" },
    { v: 2 },
    { sub: "unknown" },
  ])("rejects signed invalid claims %j", async (override) => {
    const iat = Math.floor(Date.now() / 1000);
    const cookie = signed({
      v: 1,
      sub: "user-brand",
      iat,
      exp: iat + 3600,
      aud: origin,
      ...override,
    });
    expect((await GET(req("/api/actor", { cookie }))).status).toBe(401);
  });
  it.each(["production", "test"])(
    "is disabled in %s even with local mode set",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      expect((await GET(req("/api/actor"))).status).toBe(404);
      expect(
        (
          await POST(
            req("/api/development/session", {
              method: "POST",
              body: { personId: "dev-user" },
            }),
          )
        ).status,
      ).toBe(404);
    },
  );
  it.each(["", "shared", "provider"])(
    "does not activate local selection in mode %j",
    async (mode) => {
      vi.stubEnv("ASSETHUB_ACTOR_MODE", mode);
      expect(
        (
          await POST(
            req("/api/development/session", {
              method: "POST",
              body: { personId: "dev-user" },
            }),
          )
        ).status,
      ).toBe(404);
    },
  );
  it("fails provider resolution without local fallback even with a valid local cookie", async () => {
    const { cookie } = await selection("dev-user");
    vi.stubEnv("ASSETHUB_ACTOR_MODE", "provider");
    const response = await GET(req("/api/actor", { cookie }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "PROVIDER_UNCONFIGURED" },
    });
  });
  it.each<Record<string, string>>([
    { origin: "http://evil.example" },
    { host: "evil.example" },
    { forwarded: "for=127.0.0.1" },
    { "x-forwarded-for": "127.0.0.1" },
    { "x-forwarded-host": "localhost:4301" },
    { "sec-fetch-site": "cross-site" },
    { origin: "null" },
  ])("rejects hostile ingress %j", async (headers) => {
    expect(
      (
        await POST(
          req("/api/development/session", {
            method: "POST",
            body: { personId: "dev-user" },
            headers,
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("requires Origin on selection; rejects non-JSON and malformed JSON", async () => {
    const missing = req("/api/development/session", {
      method: "POST",
      body: { personId: "dev-user" },
    });
    missing.headers.delete("origin");
    expect((await POST(missing)).status).toBe(403);
    expect(
      (
        await POST(
          req("/api/development/session", {
            method: "POST",
            body: { personId: "dev-user" },
            headers: { "content-type": "text/plain" },
          }),
        )
      ).status,
    ).toBe(403);
    const bad = new Request(`${origin}/api/development/session`, {
      method: "POST",
      headers: {
        host: "localhost:4301",
        origin,
        "content-type": "application/json",
      },
      body: "{",
    });
    expect((await POST(bad)).status).toBe(403);
  });
  it.each([
    "",
    "http://0.0.0.0:4301",
    "http://example.com:4301",
    "http://localhost:4301/path",
  ])("rejects unsafe configured origin %j", async (configured) => {
    vi.stubEnv("ASSETHUB_LOCAL_ACTOR_ORIGIN", configured);
    expect((await GET(req("/api/actor"))).status).toBeGreaterThanOrEqual(400);
  });
  it("fails closed if the listener is wildcard, unowned or cannot be verified", async () => {
    ingress.check.mockResolvedValue(false);
    expect(
      (
        await POST(
          req("/api/development/session", {
            method: "POST",
            body: { personId: "dev-user" },
          }),
        )
      ).status,
    ).toBe(503);
  });
  it("sets Secure over configured local HTTPS", async () => {
    vi.stubEnv("ASSETHUB_LOCAL_ACTOR_ORIGIN", "https://localhost:4301");
    const response = await POST(
      new Request("https://localhost:4301/api/development/session", {
        method: "POST",
        headers: {
          host: "localhost:4301",
          origin: "https://localhost:4301",
          "content-type": "application/json",
        },
        body: JSON.stringify({ personId: "user-brand" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("; Secure");
  });
  it("keeps existing session helpers independent of selection and unresolved policies denying", async () => {
    const { cookie } = await selection("user-vendor");
    const actor = await resolveServerActor(req("/api/actor", { cookie }));
    expect((await getCurrentUser())?.id).toBe("dev-user");
    expect((await getCurrentSession())?.user.capabilities).toEqual([
      "asset:read",
      "request:create",
    ]);
    expect(await hasCapability("master-data:manage")).toBe(false);
    expect(
      await unresolvedCommandPolicy.authorize(actor, "outbound.dispatch", {}),
    ).toEqual({ allowed: false, reason: "unresolved-policy" });
  });
  it("revokes pre-restart cookies with a fresh process key, never using the media key", async () => {
    const { cookie } = await selection();
    const runtime = globalThis as unknown as Record<symbol, Buffer>;
    const symbol = Symbol.for("assethub.local-actor.m1b.key");
    const original = runtime[symbol];
    vi.stubEnv("ASSETHUB_MEDIA_SIGNING_KEY", "unrelated-media-key");
    try {
      delete runtime[symbol];
      vi.resetModules();
      const fresh = await import("@/server/auth/local-actor");
      await expect(
        fresh.resolveLocalActor(req("/api/actor", { cookie })),
      ).rejects.toMatchObject({ code: "LOCAL_SESSION_INVALID" });
      expect(runtime[symbol]).not.toEqual(original);
    } finally {
      runtime[symbol] = original;
      vi.resetModules();
    }
  });
});

// Canonical repository double only; no fixture lookup remains in the runtime adapter.
vi.mock("@/server/people/canonical", async () => {
 const {peopleFixtures}=await import("@/lib/fixtures/people");
 const {ActorResolutionError}=await import("@/server/auth/actor-context");
 return {developmentPersonIds:["dev-user","user-storedev","user-brand","user-vendor","user-management"],requireCanonicalPerson:async(id:string)=>{
  const person=peopleFixtures.find(p=>p.id===id&&p.status==="ACTIVE");
  if(!person)throw new ActorResolutionError(401,"CANONICAL_PERSON_UNAVAILABLE");
  return structuredClone(person);
 }};
});
