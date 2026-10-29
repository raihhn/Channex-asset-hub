import { describe, expect, it } from "vitest";
import { validateRegistrationIntent } from "@/lib/domain/asset-registration";
const owner = "11111111-1111-4111-8111-111111111111";
export function registrationFixture() {
  return {
    commandKey: "22222222-2222-4222-8222-222222222222",
    asset: {
      name: "Wall A",
      legacyReference: "A-1.1",
      brand: "All Brand",
      category: "Supporting asset",
      classification: "ASSET",
      trackingType: "Individual",
      quantity: 1,
      unitPolicy: { stockUnit: "Unit" },
      condition: "Good",
      description: "",
      conditionNotes: "",
      location: { kind: "internal", warehouseId: "internal-1" },
      group: { mode: "standalone" },
      ownerContactId: owner,
      managementContactIds: [owner],
      metadata: {},
    },
  };
}
describe("registration intent (pure, no PostgreSQL)", () => {
  it("allows 50 distinct PICs plus an independent Owner", () => {
    const value = registrationFixture();
    value.asset.managementContactIds = Array.from(
      { length: 50 },
      (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    );
    expect(
      validateRegistrationIntent(value).asset.managementContactIds,
    ).toHaveLength(50);
  });

  it("G1-08 accepts fixed individual and supported stock units without conversion", () => {
    for (const unit of [
      "Pcs",
      "Unit",
      "Set",
      "Dus",
      "Box",
      "Pack",
      "Roll",
      "Meter",
    ]) {
      const draft = registrationFixture();
      draft.asset.unitPolicy.stockUnit = unit;
      expect(validateRegistrationIntent(draft).asset.unitPolicy.stockUnit).toBe(
        unit,
      );
    }
  });
  it.each([0, 2, 0.5, "1", null])(
    "G1-08 rejects non-one quantity %s",
    (quantity) => {
      const draft = registrationFixture();
      Object.assign(draft.asset, { quantity });
      expect(() => validateRegistrationIntent(draft)).toThrow();
    },
  );
  it("rejects package conversions, unsupported classification/condition and browser state", () => {
    for (const change of [
      { classification: "INVENTORY" },
      { trackingType: "Quantity-based" },
      { condition: "Poor" },
      { availability: "available" },
      { photos: [] },
      {
        unitPolicy: {
          stockUnit: "Pcs",
          packageUnit: "Dus",
          unitsPerPackage: 10,
        },
      },
      { brand: "Invented" },
      { category: "Unclassified" },
    ])
      expect(() =>
        validateRegistrationIntent({
          ...registrationFixture(),
          asset: { ...registrationFixture().asset, ...change },
        }),
      ).toThrow();
  });
  it("G1-05 requires owner and unique nonempty PIC references", () => {
    for (const change of [
      { ownerContactId: undefined },
      { managementContactIds: [] },
      { managementContactIds: [owner, owner.toUpperCase()] },
    ])
      expect(() =>
        validateRegistrationIntent({
          ...registrationFixture(),
          asset: { ...registrationFixture().asset, ...change },
        }),
      ).toThrow();
  });
  it("group intent cannot override inherited assignments", () => {
    expect(() =>
      validateRegistrationIntent({
        ...registrationFixture(),
        asset: {
          ...registrationFixture().asset,
          group: { mode: "existing", id: owner, expectedVersion: 1 },
        },
      }),
    ).toThrow();
  });
  it("G1-17 normalizes calendar/decimal metadata without inferring dates or currency", () => {
    const draft = registrationFixture();
    Object.assign(draft.asset.metadata, {
      receivedDate: "2024-02-29",
      assetValue: { amount: "125.0500", currency: "IDR" },
    });
    const saved = validateRegistrationIntent(draft);
    expect(saved.asset.metadata.receivedDate).toBe("2024-02-29");
    expect(saved.asset.metadata.assetValue?.amount).toBe("125.0500");
    expect(
      validateRegistrationIntent(registrationFixture()).asset.metadata
        .assetValue,
    ).toBeNull();
  });
  it.each([
    "2026-02-29",
    "2026-13-01",
    "2026-01-32",
    "45650",
    "2026-01-01T00:00:00Z",
  ])("rejects ambiguous/invalid received date %s", (receivedDate) => {
    const draft = registrationFixture();
    Object.assign(draft.asset.metadata, { receivedDate });
    expect(() => validateRegistrationIntent(draft)).toThrow();
  });
  it.each([
    { amount: 2, currency: "IDR" },
    { amount: "1.2" },
    { amount: "1e3", currency: "IDR" },
    { amount: "1.1234567", currency: "USD" },
  ])("rejects invalid amount/currency pair %j", (assetValue) => {
    const draft = registrationFixture();
    Object.assign(draft.asset.metadata, { assetValue });
    expect(() => validateRegistrationIntent(draft)).toThrow();
  });
  it("stable normalization ignores object key ordering and preserves legacy case", () => {
    const draft = registrationFixture();
    draft.asset.legacyReference = " A-1.1 ";
    draft.asset.name = " Wall A ";
    expect(validateRegistrationIntent(draft)).toEqual(
      validateRegistrationIntent({
        asset: draft.asset,
        commandKey: draft.commandKey,
      }),
    );
    expect(validateRegistrationIntent(draft).asset.legacyReference).toBe(
      "A-1.1",
    );
  });
});
