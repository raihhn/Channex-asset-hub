import { areas, brandReferences, categoryReferences, distributionCenters } from "@/lib/fixtures/organization";
import { getVendor } from "@/lib/fixtures/vendors";
import type { Person, PersonDraft, UserRole } from "@/types/identity";

export const roleLabels: Record<UserRole, string> = {
  REQUESTER: "Requester", STORE_DEV: "StoreDev", BRAND: "Brand", VENDOR: "Vendor", SUPER_ADMIN: "Super Admin", MANAGEMENT: "Management / Excom",
};

export function userHasRole(person: Person | undefined, role: UserRole) {
  return Boolean(person?.roles.includes(role));
}

export function userBrandIds(person: Person | undefined) { return person?.brandIds ?? []; }
export function userCategoryIds(person: Person | undefined) { return person?.categoryIds ?? []; }
export function userAreaIds(person: Person | undefined) { return person?.areaIds ?? []; }
export function userDcIds(person: Person | undefined) { return person?.dcIds ?? []; }
export function userVendor(person: Person | undefined) { return getVendor(person?.vendorId); }

export function scopeWarnings(person: Person | PersonDraft) {
  return person.roles.includes("STORE_DEV") && !person.brandIds.length && !person.categoryIds.length
    ? ["StoreDev scope not configured; no routing is inferred."] : [];
}

export function validatePersonDraft(draft: PersonDraft) {
  if (!draft.name.trim()) throw new Error("Name is required.");
  if (!draft.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) throw new Error("Enter a valid email address.");
  if (!draft.roles.length) throw new Error("Select at least one role.");
  if (draft.roles.includes("VENDOR") && !getVendor(draft.vendorId)) throw new Error("Vendor role requires a registered Vendor association.");
  const invalid = (ids: string[], valid: readonly { id: string }[]) => ids.some((id) => !valid.some((item) => item.id === id));
  if (invalid(draft.brandIds, brandReferences)) throw new Error("Brand scope must use Master Data IDs.");
  if (invalid(draft.categoryIds, categoryReferences)) throw new Error("Category scope must use Master Data IDs.");
  if (invalid(draft.areaIds, areas)) throw new Error("Area scope must use organizational IDs.");
  if (invalid(draft.dcIds, distributionCenters)) throw new Error("DC scope must use organizational IDs.");
  if (new Set(draft.roles).size !== draft.roles.length) throw new Error("Duplicate roles are not allowed.");
}

export function personChanges(before: Person, after: PersonDraft) {
  const fields = ["name", "email", "roles", "brandIds", "categoryIds", "areaIds", "dcIds", "vendorId", "status"] as const;
  return fields.flatMap((field) => {
    const oldValue = before[field]; const newValue = after[field];
    const oldText = Array.isArray(oldValue) ? oldValue.join(", ") : String(oldValue ?? "");
    const newText = Array.isArray(newValue) ? newValue.join(", ") : String(newValue ?? "");
    return oldText === newText ? [] : [{ field, before: oldText, after: newText }];
  });
}
