import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { resolveRequestSiteContact } from "@/server/contacts/request-site-contact";
import { peopleFixtures } from "@/lib/fixtures/people";
import type { RequestDraft } from "@/types/prototype";
import type { UserRole } from "@/types/identity";
vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("@/server/contacts/repository", () => ({
  InternalContactsRepository: class {
    resolve = db.resolve;
  },
}));
const client = {} as PoolClient;
const id = "11111111-1111-4111-8111-111111111111";
const draft = {
  siteContact: "Browser spoof",
  siteContactInternalId: id,
} as RequestDraft;
const contact = {
  id,
  name: "Canonical contact",
  email: "canonical@example.com",
  phone: "123",
};
beforeEach(() => {
  vi.clearAllMocks();
  db.resolve.mockResolvedValue([contact]);
});
describe("Request directory linking without permission expansion", () => {
  it.each<UserRole>(["STORE_DEV", "SUPER_ADMIN"])(
    "uses canonical channels for %s and does not mutate the command fingerprint input",
    async (role) => {
      const before = JSON.stringify(draft);
      const saved = await resolveRequestSiteContact(client, draft, {
        ...peopleFixtures[0],
        roles: [role],
      });
      expect(saved).toEqual({
        ...draft,
        siteContact: "Canonical contact · 123 · canonical@example.com",
      });
      expect(JSON.stringify(draft)).toBe(before);
      expect(db.resolve).toHaveBeenCalledWith([id]);
    },
  );
  it.each<UserRole>(["REQUESTER", "BRAND", "VENDOR", "MANAGEMENT"])(
    "denies a new ID selection by %s without exposing contacts",
    async (role) => {
      await expect(
        resolveRequestSiteContact(client, draft, {
          ...peopleFixtures[0],
          roles: [role],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.resolve).not.toHaveBeenCalled();
    },
  );
  it("leaves legacy/manual drafts completely unchanged", async () => {
    const manual = { siteContact: "Vendor PIC · phone" } as RequestDraft;
    expect(
      await resolveRequestSiteContact(client, manual, peopleFixtures[3]),
    ).toBe(manual);
    expect(db.resolve).not.toHaveBeenCalled();
  });
  it("preserves an unchanged historical reference on an authorized resubmission after a role change, without listing the directory", async () => {
    const actor = { ...peopleFixtures[0], roles: ["REQUESTER" as const] };
    const previous = {
      siteContactInternalId: id,
      siteContact: "Historical snapshot",
    };
    const retained = { ...draft, ...previous };
    expect(
      await resolveRequestSiteContact(client, retained, actor, previous),
    ).toEqual(retained);
    await expect(
      resolveRequestSiteContact(
        client,
        { ...retained, siteContact: "Changed" },
        actor,
        previous,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.resolve).not.toHaveBeenCalled();
  });
  it("rejects invalid IDs and propagates unavailable contact errors", async () => {
    await expect(
      resolveRequestSiteContact(
        client,
        { ...draft, siteContactInternalId: "user-storedev" },
        peopleFixtures[0],
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(db.resolve).not.toHaveBeenCalled();
    db.resolve.mockRejectedValue(Error("Inactive contact"));
    await expect(
      resolveRequestSiteContact(client, draft, peopleFixtures[0]),
    ).rejects.toThrow("Inactive contact");
  });
});
