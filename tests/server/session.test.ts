import { getCurrentSession, getCurrentUser } from "@/server/auth/session";
import { sessionHasCapability } from "@/server/authorization/capabilities";

describe("session boundary", () => {
  it("returns the development adapter without exposing a provider SDK", async () => {
    const session = await getCurrentSession();

    expect(session?.source).toBe("development");
    expect((await getCurrentUser())?.displayName).toBe("Development workspace");
    expect(sessionHasCapability(session, "asset:read")).toBe(true);
    expect(sessionHasCapability(session, "master-data:manage")).toBe(false);
  });
});
