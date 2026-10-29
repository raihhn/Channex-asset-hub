import { describe, expect, it } from "vitest";

import {
  getAssetClassification,
  getAssetClassificationLabel,
  isDisposalReviewRecommended,
} from "@/lib/domain/asset-governance";

describe("asset classification and inventory review selectors", () => {
  it("defaults an older unclassified physical item to Asset", () => {
    expect(getAssetClassification({})).toBe("ASSET");
    expect(getAssetClassificationLabel({})).toBe("Asset");
  });

  it("labels reusable inventory for internal users", () => {
    expect(getAssetClassificationLabel({ classification: "INVENTORY" })).toBe(
      "Reusable Inventory",
    );
  });

  it("recommends review only for inventory unused for at least two years", () => {
    const now = new Date("2026-10-06T12:00:00.000Z");
    expect(
      isDisposalReviewRecommended(
        { classification: "INVENTORY", lastUsedAt: "2024-10-05" },
        now,
      ),
    ).toBe(true);
    expect(
      isDisposalReviewRecommended(
        { classification: "INVENTORY", lastUsedAt: "2024-10-07" },
        now,
      ),
    ).toBe(false);
    expect(
      isDisposalReviewRecommended({ classification: "INVENTORY" }, now),
    ).toBe(false);
    expect(
      isDisposalReviewRecommended(
        { classification: "ASSET", lastUsedAt: "2020-01-01" },
        now,
      ),
    ).toBe(false);
  });
});
