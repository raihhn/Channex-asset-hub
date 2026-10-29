import type { Asset } from "@/types/prototype";

export const assetUnits = [
  "Pcs",
  "Unit",
  "Set",
  "Dus",
  "Box",
  "Pack",
  "Roll",
  "Meter",
] as const;
export type AssetUnit = (typeof assetUnits)[number];
export type UnitPolicy = {
  stockUnit: AssetUnit;
  packageUnit?: AssetUnit;
  unitsPerPackage?: number;
};
export function validateUnitPolicy(policy: UnitPolicy) {
  if (!assetUnits.includes(policy.stockUnit))
    throw new Error("Choose a stock unit.");
  if (policy.packageUnit) {
    if (
      !assetUnits.includes(policy.packageUnit) ||
      policy.packageUnit === policy.stockUnit
    )
      throw new Error("Packaging unit must differ from the stock unit.");
    if (
      !Number.isSafeInteger(policy.unitsPerPackage) ||
      policy.unitsPerPackage! < 1
    )
      throw new Error("Enter a whole number of stock units per package.");
  }
}
export function stockUnit(
  asset: Pick<Asset, "unitPolicy" | "category">,
): AssetUnit {
  return (
    asset.unitPolicy?.stockUnit ?? (asset.category === "Booth" ? "Set" : "Unit")
  );
}
export function borrowingUnits(
  asset: Pick<Asset, "unitPolicy" | "category">,
): AssetUnit[] {
  const base = stockUnit(asset);
  if (!asset.unitPolicy?.packageUnit) return [base];
  try {
    validateUnitPolicy(asset.unitPolicy);
  } catch {
    return [base];
  }
  return [base, asset.unitPolicy.packageUnit];
}
export function toStockQuantity(
  policy: UnitPolicy,
  quantity: number,
  unit: AssetUnit,
) {
  validateUnitPolicy(policy);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    (unit !== "Meter" && !Number.isSafeInteger(quantity))
  )
    throw new Error("Enter a valid positive quantity.");
  if (unit === policy.stockUnit) return quantity;
  if (unit !== policy.packageUnit)
    throw new Error("This borrowing unit is not configured.");
  const result = quantity * policy.unitsPerPackage!;
  if (!Number.isFinite(result) || result > Number.MAX_SAFE_INTEGER)
    throw new Error("Quantity is too large.");
  return result;
}

/** Clamp in the chosen borrowing unit; never create a partial package. */
export function changeBorrowQuantity(
  asset: Pick<Asset, "unitPolicy" | "category" | "availableQuantity">,
  stockQuantity: number,
  unit: AssetUnit,
  delta: number,
) {
  const policy = asset.unitPolicy ?? { stockUnit: stockUnit(asset) };
  const factor = toStockQuantity(policy, 1, unit);
  const maximum = Math.floor((asset.availableQuantity ?? 1) / factor);
  if (maximum < 1) throw new Error("Not enough stock for one package.");
  return (
    Math.max(1, Math.min(maximum, Math.floor(stockQuantity / factor) + delta)) *
    factor
  );
}
