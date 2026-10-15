import { describe, expect, it } from "vitest";
import { validateVendorDraft } from "@/lib/domain/vendor-master";
const contactId = "10000000-0000-4000-8000-000000000001";
function draft() {
  return {
    name: " Ofsorts ",
    legalName: "Orang Seni Sejahtera",
    active: true,
    contacts: [
      {
        id: contactId,
        name: "Laura",
        phone: "0817-4922-610",
        email: "Laura@ofsorts.co",
        active: true,
      },
    ],
    warehouses: [
      {
        id: "10000000-0000-4000-8000-000000000011",
        name: "Jakarta",
        address: "Free text\nWarehouse address",
        addressVerified: false,
        active: true,
        contactIds: [contactId],
      },
      {
        id: "10000000-0000-4000-8000-000000000012",
        name: "Jatim",
        address: "Surabaya",
        addressVerified: true,
        active: true,
        contactIds: [contactId],
      },
    ],
  };
}
describe("vendor master validation", () => {
  it("keeps one PIC reusable across warehouses and free-text addresses", () => {
    const d = validateVendorDraft(draft());
    expect(d.name).toBe("Ofsorts");
    expect(d.contacts[0].email).toBe("laura@ofsorts.co");
    expect(d.warehouses[0].address).toContain("\n");
    expect(d.warehouses.map((w) => w.contactIds)).toEqual([
      [contactId],
      [contactId],
    ]);
  });
  it("rejects foreign PIC references and duplicate warehouse names", () => {
    const d = draft();
    d.warehouses[0].contactIds = ["10000000-0000-4000-8000-000000000099"];
    expect(() => validateVendorDraft(d)).toThrow("belong to this vendor");
    const dup = draft();
    dup.warehouses[1].name = " jakarta ";
    expect(() => validateVendorDraft(dup)).toThrow("Duplicate warehouse name");
  });
  it("requires active contact for an active warehouse", () => {
    const d = draft();
    d.contacts[0].active = false;
    expect(() => validateVendorDraft(d)).toThrow("active PIC");
    d.warehouses.forEach((w) => (w.active = false));
    expect(() => validateVendorDraft(d)).not.toThrow();
  });
  it("rejects malformed payload, phone, email and oversized values", () => {
    expect(() => validateVendorDraft(null)).toThrow();
    const d = draft();
    d.contacts[0].phone = "Laura";
    expect(() => validateVendorDraft(d)).toThrow("phone");
    d.contacts[0].phone = "081234567";
    d.contacts[0].email = "invalid";
    expect(() => validateVendorDraft(d)).toThrow("email");
    const long = draft();
    long.warehouses[0].address = "x".repeat(4001);
    expect(() => validateVendorDraft(long)).toThrow("4000");
  });
});
