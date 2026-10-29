import type { VendorDraft } from "@/types/vendor";

export class VendorError extends Error {
  constructor(
    public code:
      | "VALIDATION"
      | "FORBIDDEN"
      | "DISABLED"
      | "NOT_FOUND"
      | "STALE"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "VendorError";
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateVendorId(value: unknown): string {
  if (typeof value !== "string" || !uuid.test(value))
    throw new VendorError("VALIDATION", "Invalid record ID.");
  return value.toLowerCase();
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new VendorError("VALIDATION", "Invalid vendor data.");
  return value as Record<string, unknown>;
}
function text(
  value: unknown,
  label: string,
  max: number,
  optional = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!optional && !value.trim())
  )
    throw new VendorError(
      "VALIDATION",
      `Complete ${label} (maximum ${max} characters).`,
    );
  return value.trim();
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new VendorError("VALIDATION", "Invalid active/verified status.");
  return value;
}
function rows(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new VendorError(
      "VALIDATION",
      `Invalid ${label}; maximum 100 entries.`,
    );
  return value;
}
function distinct(values: string[], label: string) {
  if (new Set(values.map((v) => v.toLowerCase())).size !== values.length)
    throw new VendorError("VALIDATION", `Duplicate ${label}.`);
}
export function validateVendorDraft(value: unknown): VendorDraft {
  const v = object(value);
  const contacts = rows(v.contacts, "PICs").map((value) => {
    const c = object(value);
    const email = text(c.email, "PIC email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new VendorError("VALIDATION", "Enter a valid PIC email.");
    const phone = text(c.phone, "PIC phone", 80);
    if (!/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, "").length < 6)
      throw new VendorError("VALIDATION", "Enter a valid PIC phone number.");
    return {
      id: validateVendorId(c.id),
      name: text(c.name, "PIC name", 200),
      phone,
      email,
      active: bool(c.active),
    };
  });
  distinct(
    contacts.map((c) => c.id),
    "PIC ID",
  );
  const warehouses = rows(v.warehouses, "warehouses").map((value) => {
    const w = object(value);
    const contactIds = rows(w.contactIds, "warehouse PICs").map(
      validateVendorId,
    );
    distinct(contactIds, "warehouse PIC");
    if (contactIds.some((id) => !contacts.some((c) => c.id === id)))
      throw new VendorError(
        "VALIDATION",
        "Warehouse PIC must belong to this vendor.",
      );
    const active = bool(w.active);
    if (
      active &&
      !contactIds.some((id) => contacts.some((c) => c.id === id && c.active))
    )
      throw new VendorError(
        "VALIDATION",
        "Each active warehouse needs an active PIC.",
      );
    return {
      id: validateVendorId(w.id),
      name: text(w.name, "warehouse name", 200),
      address: text(w.address, "warehouse address", 4000),
      addressVerified: bool(w.addressVerified),
      active,
      contactIds,
    };
  });
  distinct(
    warehouses.map((w) => w.id),
    "warehouse ID",
  );
  distinct(
    warehouses.map((w) => w.name),
    "warehouse name",
  );
  if (!warehouses.length)
    throw new VendorError("VALIDATION", "Add at least one warehouse.");
  return {
    name: text(v.name, "vendor name", 200),
    legalName: text(v.legalName, "legal name", 200, true),
    active: bool(v.active),
    contacts,
    warehouses,
  };
}
