import { assetUnits, type AssetUnit } from "./asset-units";
import { internalContactIds } from "./internal-contacts";
import { VendorError, validateVendorId } from "./vendor-master";
import type { Asset, AssetCondition } from "@/types/prototype";

export type RegistrationMetadata = {
  receivedDate?: string;
  assetValue?: { amount: string; currency: string } | null;
  eventProjectReference?: string;
  additionalNotes?: string;
};
export type RegistrationGroup =
  | { mode: "standalone" }
  | {
      mode: "create";
      name: string;
      ownerContactId: string;
      managingContactId: string;
    }
  | { mode: "existing"; id: string; expectedVersion: number };
export type RegistrationIntent = {
  commandKey: string;
  asset: {
    name: string;
    legacyReference: string;
    brand: string;
    category: Asset["category"];
    classification: "ASSET";
    trackingType: "Individual";
    quantity: 1;
    unitPolicy: { stockUnit: AssetUnit };
    condition: AssetCondition;
    conditionNotes: string;
    description: string;
    location:
      | { kind: "internal"; warehouseId: string }
      | { kind: "vendor"; vendorId: string; warehouseId: string };
    group: RegistrationGroup;
    ownerContactId?: string;
    managementContactIds?: string[];
    metadata: RegistrationMetadata;
  };
};
export function registrationInvalid(
  message = "Invalid registration intent.",
): never {
  throw new VendorError("VALIDATION", message);
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    registrationInvalid();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key)))
    registrationInvalid("Unsupported registration field.");
  return result;
}
function text(value: unknown, limit: number, required = false): string {
  if (value === undefined && !required) return "";
  if (
    typeof value !== "string" ||
    value.length > limit ||
    (required && !value.trim())
  )
    registrationInvalid();
  return value.trim();
}
const brands = [
  "All Brand",
  "Wardah",
  "Make Over",
  "Emina",
  "Kahf",
  "Corporate",
];
const categories = ["Booth", "Display", "POSM", "Supporting asset"] as const;
export function validateRegistrationIntent(input: unknown): RegistrationIntent {
  const root = object(input, ["commandKey", "asset"]);
  const a = object(root.asset, [
    "name",
    "legacyReference",
    "brand",
    "category",
    "classification",
    "trackingType",
    "quantity",
    "unitPolicy",
    "condition",
    "conditionNotes",
    "description",
    "location",
    "group",
    "ownerContactId",
    "managementContactIds",
    "metadata",
  ]);
  if (
    a.classification !== "ASSET" ||
    a.trackingType !== "Individual" ||
    a.quantity !== 1
  )
    registrationInvalid("Registration requires one individual ASSET.");
  if (
    !brands.includes(a.brand as string) ||
    !categories.includes(a.category as (typeof categories)[number])
  )
    registrationInvalid("Choose an existing brand and category.");
  if (!["Good", "Fair", "Needs review"].includes(a.condition as string))
    registrationInvalid("Choose a canonical condition.");
  const unit = object(a.unitPolicy, ["stockUnit"]);
  if (!assetUnits.includes(unit.stockUnit as AssetUnit))
    registrationInvalid("Choose a valid stock unit.");
  const loc = object(a.location, ["kind", "warehouseId", "vendorId"]);
  let location: RegistrationIntent["asset"]["location"];
  if (loc.kind === "internal" && loc.vendorId === undefined)
    location = {
      kind: "internal",
      warehouseId: text(loc.warehouseId, 250, true),
    };
  else if (loc.kind === "vendor")
    location = {
      kind: "vendor",
      warehouseId: validateVendorId(loc.warehouseId),
      vendorId: validateVendorId(loc.vendorId),
    };
  else registrationInvalid("Choose an internal or vendor warehouse.");
  const g = object(a.group, [
    "mode",
    "name",
    "id",
    "expectedVersion",
    "ownerContactId",
    "managingContactId",
  ]);
  let group: RegistrationGroup;
  let ownerContactId: string | undefined,
    managementContactIds: string[] | undefined;
  if (g.mode === "standalone" && Object.keys(g).length === 1) {
    group = { mode: "standalone" };
    ownerContactId = validateVendorId(a.ownerContactId);
    managementContactIds = internalContactIds(a.managementContactIds);
    if (!managementContactIds.length)
      registrationInvalid("Choose at least one managing PIC.");
  } else if (
    g.mode === "create" &&
    Object.keys(g).every((k) =>
      ["mode", "name", "ownerContactId", "managingContactId"].includes(k),
    )
  ) {
    group = {
      mode: "create",
      name: text(g.name, 250, true),
      ownerContactId: validateVendorId(g.ownerContactId),
      managingContactId: validateVendorId(g.managingContactId),
    };
  } else if (
    g.mode === "existing" &&
    Object.keys(g).every((k) => ["mode", "id", "expectedVersion"].includes(k))
  ) {
    if (
      !Number.isSafeInteger(g.expectedVersion) ||
      Number(g.expectedVersion) < 1
    )
      registrationInvalid("Choose a current group version.");
    group = {
      mode: "existing",
      id: validateVendorId(g.id),
      expectedVersion: g.expectedVersion as number,
    };
  } else registrationInvalid("Invalid group intent.");
  if (
    group.mode !== "standalone" &&
    (a.ownerContactId !== undefined || a.managementContactIds !== undefined)
  )
    registrationInvalid("Group assignments cannot be overridden.");
  return {
    commandKey: validateVendorId(root.commandKey),
    asset: {
      name: text(a.name, 250, true),
      legacyReference: text(a.legacyReference, 250),
      brand: a.brand as string,
      category: a.category as Asset["category"],
      classification: "ASSET",
      trackingType: "Individual",
      quantity: 1,
      unitPolicy: { stockUnit: unit.stockUnit as AssetUnit },
      condition: a.condition as AssetCondition,
      conditionNotes: text(a.conditionNotes, 2000),
      description: text(a.description, 2000),
      location,
      group,
      ...(ownerContactId ? { ownerContactId, managementContactIds } : {}),
      metadata: validateRegistrationMetadata(a.metadata),
    },
  };
}

export function validateRegistrationMetadata(
  input: unknown,
): RegistrationMetadata {
  const m = object(input ?? {}, [
    "receivedDate",
    "assetValue",
    "eventProjectReference",
    "additionalNotes",
  ]);
  const receivedDate = text(m.receivedDate, 10);
  if (
    receivedDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate) ||
      new Date(receivedDate).toJSON()?.slice(0, 10) !== receivedDate)
  )
    registrationInvalid("Enter a valid received calendar date.");
  let assetValue: RegistrationMetadata["assetValue"] = null;
  if (m.assetValue != null) {
    const value = object(m.assetValue, ["amount", "currency"]);
    if (
      typeof value.amount !== "string" ||
      !/^-?\d{1,18}(?:\.\d{1,6})?$/.test(value.amount) ||
      typeof value.currency !== "string" ||
      !/^[A-Z]{3}$/.test(value.currency)
    )
      registrationInvalid(
        "Value requires a decimal string and explicit currency.",
      );
    assetValue = { amount: value.amount, currency: value.currency };
  }

  return {
    receivedDate,
    assetValue,
    eventProjectReference: text(m.eventProjectReference, 2000),
    additionalNotes: text(m.additionalNotes, 2000),
  };
}
