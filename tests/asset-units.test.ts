import { describe, expect, it } from "vitest";
import {
  borrowingUnits,
  toStockQuantity,
  validateUnitPolicy,
  changeBorrowQuantity,
} from "@/lib/domain/asset-units";

describe("asset stock and borrowing units", () => {
  it("converts packages into the same stock unit used by loose items", () => {
    const policy = {
      stockUnit: "Pcs",
      packageUnit: "Dus",
      unitsPerPackage: 12,
    } as const;
    expect(toStockQuantity(policy, 2, "Dus")).toBe(24);
    expect(toStockQuantity(policy, 3, "Pcs")).toBe(3);
    expect(borrowingUnits({ category: "POSM", unitPolicy: policy })).toEqual([
      "Pcs",
      "Dus",
    ]);
  });
  it("never guesses conversion for unknown or intact packages", () => {
    expect(
      borrowingUnits({ category: "POSM", unitPolicy: { stockUnit: "Dus" } }),
    ).toEqual(["Dus"]);
    expect(() => toStockQuantity({ stockUnit: "Dus" }, 1, "Pcs")).toThrow();
    for (const unitsPerPackage of [0, -1, 1.5, NaN])
      expect(() =>
        validateUnitPolicy({
          stockUnit: "Pcs",
          packageUnit: "Dus",
          unitsPerPackage,
        }),
      ).toThrow();
  });
  it("respects package boundaries when stock is not divisible", () => {
    const asset = {
      category: "POSM",
      unitPolicy: { stockUnit: "Pcs", packageUnit: "Dus", unitsPerPackage: 12 },
      availableQuantity: 25,
    } as const;
    expect(changeBorrowQuantity(asset, 24, "Dus", 1)).toBe(24);
    expect(changeBorrowQuantity(asset, 12, "Dus", -1)).toBe(12);
    expect(changeBorrowQuantity(asset, 24, "Pcs", 1)).toBe(25);
    expect(() =>
      changeBorrowQuantity({ ...asset, availableQuantity: 11 }, 1, "Dus", 1),
    ).toThrow();
  });
});
