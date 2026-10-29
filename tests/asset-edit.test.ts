import { describe, expect, it } from "vitest";
import { assetEditDefaults, validateAssetEdit } from "@/lib/domain/asset-edit";
import { prototypeAssets } from "@/lib/fixtures/prototype-data";

describe("Asset metadata editing", () => {
  const asset = prototypeAssets[0];
  it("allows missing optional details without inventing source dates", () => {
    const edit = validateAssetEdit(assetEditDefaults(asset));
    expect(edit.name).toBe(asset.name);
    expect(edit.details.confirmedDate).toBe("");
    expect(edit.details.composition).toBe("Unconfirmed");
  });
  it("preserves ambiguous source contacts without guessing boundaries", () => {
    const imported = {
      ...asset,
      importInfo: {
        ...asset.importInfo,
        ownerEmail: "first@example.com\nsecond@example.com",
        picEmail: "first@example.comsecond@example.com",
      },
    } as typeof asset;
    const edit = assetEditDefaults(imported);
    expect(edit.details.ownerEmail).toBe(
      "first@example.com, second@example.com",
    );
    expect(edit.details.picEmail).toBe("");
    expect(imported.importInfo?.picEmail).toBe(
      "first@example.comsecond@example.com",
    );
    expect(validateAssetEdit(edit).details.ownerEmail).toBe(
      "first@example.com, second@example.com",
    );
  });
  it("rejects empty names and malformed emails", () => {
    expect(() =>
      validateAssetEdit({ ...assetEditDefaults(asset), name: " " }),
    ).toThrow();
    const edit = assetEditDefaults(asset);
    edit.details.ownerEmail = "invalid";
    expect(() => validateAssetEdit(edit)).toThrow();
  });
  it("requires a real date with explicit meaning", () => {
    const edit = assetEditDefaults(asset);
    edit.details.confirmedDate = "2026-02-30";
    edit.details.dateMeaning = "Event";
    expect(() => validateAssetEdit(edit)).toThrow();
    edit.details.confirmedDate = "2026-02-25";
    edit.details.dateMeaning = "Unconfirmed";
    expect(() => validateAssetEdit(edit)).toThrow();
    edit.details.dateMeaning = "Received";
    expect(validateAssetEdit(edit).details.confirmedDate).toBe("2026-02-25");
  });
  it("cannot write operational fields or original evidence through metadata input", () => {
    const original = structuredClone(asset);
    const edit = validateAssetEdit({
      ...assetEditDefaults(asset),
      availability: "available",
      totalQuantity: 999,
      location: "Injected",
      importInfo: { notes: "replaced" },
      photos: [],
    });
    const result = { ...asset, ...edit };
    expect(result.availability).toBe(original.availability);
    expect(result.totalQuantity).toBe(original.totalQuantity);
    expect(result.location).toBe(original.location);
    expect(result.photos).toEqual(original.photos);
    expect(result.importInfo).toEqual(original.importInfo);
  });
});
