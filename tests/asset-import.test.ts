import { describe, it, expect } from "vitest";
import {
  parseQuantity,
  mapSourceRow,
  buildWarehouseAliases,
} from "../scripts/asset-import-mapping.mjs";
const vendor = {
  vendor: "Dua Garis Imagi",
  warehouse: "Jatim",
  vendor_id: "v",
  warehouse_id: "w",
  address: "Jatim address",
  active: true,
  address_verified: true,
};
const aliases = buildWarehouseAliases(
  [vendor],
  [
    {
      vendor: vendor.vendor,
      warehouse: vendor.warehouse,
      address: vendor.address,
    },
  ],
);
const row = {
  sheet: "ALL BRAND (Storedev)",
  row: 4,
  values: {
    E: "Booth",
    M: "Eksternal",
    N: "Hanuman",
    O: "Old address",
    B: "Asset",
    P: "1",
    Q: "Set",
    H: "Wardah",
    W: "Aktif",
    X: "Baik",
    Z: "Seharusnya di vendor DGI Jatim",
  },
  photos: [],
};
describe("confirmed warehouse aliases", () => {
  it("resolves DGI Jateng to Semarang only after the explicit user confirmation", () => {
    const semarang = {
      ...vendor,
      warehouse: "Semarang",
      warehouse_id: "semarang",
      address: "Semarang address",
    };
    const confirmed = buildWarehouseAliases(
      [semarang],
      [
        {
          vendor: semarang.vendor,
          warehouse: semarang.warehouse,
          address: semarang.address,
        },
      ],
    );
    for (const n of [47, 222]) {
      const result = mapSourceRow({ ...row, row: n }, confirmed);
      expect(result.record.warehouseId).toBe("semarang");
      expect(result.record.locationDetail).toBe("Semarang address");
    }
  });
});
describe("workbook asset import mapping", () => {
  it("uses explicit notes corrections and the destination address without overwriting provenance", () => {
    const result = mapSourceRow(row, aliases);
    expect(result.record.location).toBe("Dua Garis Imagi — Jatim");
    expect(result.record.locationDetail).toBe("Jatim address");
    expect(result.record.importInfo.originalLocation).toBe("Hanuman");
    expect(row.values.O).toBe("Old address");
  });
  it("keeps unknown-location and partial-transfer rows on hold", () => {
    for (const n of [45, 62, 63, 397]) {
      const result = mapSourceRow({ ...row, row: n }, aliases);
      expect(result.record.availability).toBe("unavailable");
      expect(result.record.importInfo.warnings.length).toBeGreaterThan(0);
      expect(result.record.warehouseId).toBeUndefined();
    }
  });
  it("parses source packaging without guessing its contents", () => {
    expect(parseQuantity("2 dus", "")).toEqual({
      quantity: 2,
      unit: "Dus",
      conflict: false,
    });
    expect(parseQuantity("1 set (4 pcs)", "")).toEqual({
      quantity: 1,
      unit: "Set",
      conflict: false,
    });
    expect(parseQuantity("", "PCS").quantity).toBeNull();
    expect(parseQuantity("2 dus", "PCS").conflict).toBe(true);
  });
  it("preserves independent walls, unknown classification and event context", () => {
    const result = mapSourceRow(
      {
        ...row,
        sheet: "ALL BRAND (Gd.Internal)",
        row: 2,
        values: {
          E: "TOTEM SKYBRIDGE",
          D: "A-1.1.1\nWALL A",
          M: "Internal",
          N: "Jatake 5",
          P: "1",
          Q: "SET",
          AA: "BST-2025",
          H: "ALL BRAND",
        },
      },
      aliases,
    );
    expect(result.record.name).toBe("Totem Skybridge — WALL A");
    expect(result.record.classification).toBe("UNCLASSIFIED");
    expect(result.record.importInfo.eventName).toBe("BST-2025");
    expect(result.record.importInfo.setupName).toBe("Totem Skybridge");
    expect(result.record.producedAt).toBe("");
    expect(result.record.photos).toHaveLength(0);
  });
  it("corrects the explicit source count update, retaining the old Qty", () => {
    const result = mapSourceRow(
      {
        ...row,
        row: 56,
        values: {
          ...row.values,
          P: "2",
          N: "Dua Garis Imagi Jatim",
          Z: "Update aset hanya 1 set di DGI Jabar",
        },
      },
      aliases,
    );
    expect(result.record.totalQuantity).toBe(1);
    expect(result.record.importInfo.sourceQty).toBe("2");
  });
});
