import { describe, expect, it } from "vitest";
import { AmbiguousLegacyGroupError, normalizeGroupItemIds, preserveRequestItemIds } from "@/lib/domain/request-item-identity";
import type { RequestItem, ReturnGroup } from "@/types/prototype";

const items: RequestItem[] = [
  { id: "item-one", assetId: "asset-a", quantity: 1 },
  { id: "item-two", assetId: "asset-b", quantity: 1 },
];

describe("RequestItem identity migration", () => {
  it("preserves a surviving item and gives a newly added line a new identity", () => {
    const revised = preserveRequestItemIds(items, [{ assetId: "asset-a", quantity: 1 }, { assetId: "asset-c", quantity: 1 }], () => "new-id");
    expect(revised.map((item) => item.id)).toEqual(["item-one", "new-id"]);
    expect(() => preserveRequestItemIds(items, [{ assetId: "asset-a", quantity: 1 }, { assetId: "asset-a", quantity: 1 }], () => "new-id")).toThrow(/only once/);
  });

  it("normalizes legacy Asset IDs to RequestItem IDs and accepts already-normalized IDs", () => {
    const groups: ReturnGroup[] = [{ id: "return", method: "User return", from: "venue", to: "hub", window: "today", itemIds: ["asset-a", "item-two"] }];
    expect(normalizeGroupItemIds(groups, items)?.[0].itemIds).toEqual(["item-one", "item-two"]);
  });

  it("never guesses an ambiguous legacy Asset mapping", () => {
    const duplicate: RequestItem[] = [...items, { id: "another-a", assetId: "asset-a", quantity: 1 }];
    expect(() => normalizeGroupItemIds([{ id: "return", method: "User return", from: "venue", to: "hub", window: "today", itemIds: ["asset-a"] }], duplicate)).toThrow(AmbiguousLegacyGroupError);
  });
});
