// @vitest-environment node
import { createServer } from "node:net";
import { describe, expect, it, vi } from "vitest";
import {
  hasOnlyLoopbackListener,
  isOnlyLoopbackListing,
} from "@/server/auth/loopback-listener";
vi.mock("server-only", () => ({}));
async function listener(host: string) {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  return { server, port: address.port };
}
async function close(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
describe("real read-only listener inspection", () => {
  it.each([
    "n*:4301",
    "n0.0.0.0:4301",
    "n[::]:4301",
    "n192.168.1.1:4301",
    "",
    "n127.0.0.1:99\nn*:4301",
  ])(
    "rejects unsafe/unverified listener listing %j without opening that socket",
    (listing) => {
      expect(isOnlyLoopbackListing(listing, 4301)).toBe(false);
    },
  );
  it("accepts IPv4 and IPv6 loopback listings", () => {
    expect(
      isOnlyLoopbackListing("p123\nn127.0.0.1:4301\nn[::1]:4301", 4301),
    ).toBe(true);
  });
  it("accepts this process's real loopback socket; rejects unrelated ports", async () => {
    const local = await listener("127.0.0.1");
    try {
      expect(await hasOnlyLoopbackListener(local.port)).toBe(true);
      expect(await hasOnlyLoopbackListener(1)).toBe(false);
      try {
        vi.stubEnv("PATH", "");
        expect(await hasOnlyLoopbackListener(local.port)).toBe(false);
      } finally {
        vi.unstubAllEnvs();
      }
    } finally {
      await close(local.server);
    }
  });
});
