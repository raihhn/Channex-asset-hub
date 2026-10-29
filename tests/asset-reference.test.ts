import { describe, expect, it } from "vitest";
import { assetReference } from "@/lib/domain/asset-reference";
import type { Asset } from "@/types/prototype";

describe("permanent asset reference", () => {
  const asset = { id: "xls-internal", code: "OLD-001", legacyReference: "LEGACY-002" } as Asset;
  it("prefers the PostgreSQL number without losing a separate legacy reference", () => {
    expect(assetReference({ ...asset, assetNumber: "AST-000123" })).toBe("AST-000123");
    expect(asset.legacyReference).toBe("LEGACY-002");
  });
  it("keeps pre-numbering references readable", () => {
    expect(assetReference(asset)).toBe("LEGACY-002");
  });
  it("never presents an internal identity as an asset number", () => {
    expect(assetReference({ id: "xls-internal", code: "xls-internal" } as Asset)).toBeUndefined();
  });
});
