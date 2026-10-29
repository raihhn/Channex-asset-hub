import { describe, it, expect } from "vitest";
import { currentWarehouseContact } from "@/lib/domain/asset-location-contacts";
import { prototypeAssets } from "@/lib/fixtures/prototype-data";
import type { RegisteredLocation } from "@/lib/fixtures/registered-locations";
const location: RegisteredLocation = {
  id: "warehouse-one",
  vendorId: "vendor-one",
  name: "Vendor One — Jakarta",
  type: "Vendor warehouse",
  address: "Recorded",
  city: "Jakarta",
  contact: "Warehouse PIC · 123",
};
const asset = {
  ...prototypeAssets[0],
  warehouseId: location.id,
  vendorId: location.vendorId,
  location: location.name,
  locationType: location.type,
  currentCustodian: "Last receiver",
};
describe("recorded asset location contact", () => {
  it("uses the warehouse ID to show existing directory contact without replacing custodian or owner", () => {
    const before = structuredClone(asset);
    expect(currentWarehouseContact(asset, [location])).toBe(location.contact);
    expect(asset).toEqual(before);
    expect(asset.currentCustodian).toBe("Last receiver");
  });
  it("hides a stale warehouse contact after location changes", () => {
    expect(
      currentWarehouseContact({ ...asset, location: "Event venue" }, [
        location,
      ]),
    ).toBeUndefined();
    expect(
      currentWarehouseContact({ ...asset, locationType: "Event venue" }, [
        location,
      ]),
    ).toBeUndefined();
  });
  it("never guesses by name or across vendors", () => {
    expect(
      currentWarehouseContact({ ...asset, warehouseId: undefined }, [location]),
    ).toBeUndefined();
    expect(
      currentWarehouseContact({ ...asset, vendorId: "different" }, [location]),
    ).toBeUndefined();
  });
  it("does not fabricate missing or unavailable contacts", () => {
    expect(currentWarehouseContact(asset, [])).toBeUndefined();
    expect(
      currentWarehouseContact(asset, [{ ...location, contact: undefined }]),
    ).toBeUndefined();
  });
});
