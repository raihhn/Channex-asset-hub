import type { Person } from "@/types/identity";
import type { FinancialReference } from "@/types/prototype";

export type FinancialReferenceOwner = Pick<FinancialReference, "ownerType" | "ownerId">;

export function validateFinancialReferenceEditor(actor: Person) {
  if (!actor.roles.includes("SUPER_ADMIN")) {
    throw new Error("Only the prototype Super Admin can edit manual financial references.");
  }
}

export function normalizeFinancialReferenceValue(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error("Enter a reference number.");
  return normalized;
}

export function referencesForOwner(references: FinancialReference[], owner: FinancialReferenceOwner) {
  return references.filter((reference) => reference.ownerType === owner.ownerType && reference.ownerId === owner.ownerId);
}
