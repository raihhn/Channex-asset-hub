import { VendorError } from "./vendor-master";

/** Asset management contacts are business metadata, never login identities. */
export type AssetContact = {
  name: string;
  email: string;
  phone: string;
  id?: string;
  active?: boolean;
};

export function validateAssetContacts(value: unknown): AssetContact[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new VendorError("VALIDATION", "Invalid asset contact list.");
  return value.flatMap((contact) => {
    if (!contact || typeof contact !== "object")
      throw new VendorError("VALIDATION", "Invalid asset contact.");
    const result = {} as AssetContact;
    for (const key of ["name", "email", "phone"] as const) {
      if (typeof contact[key] !== "string" || contact[key].length > 250)
        throw new VendorError("VALIDATION", "Invalid asset contact field.");
      result[key] = contact[key].trim();
    }
    if (!result.name && !result.email && !result.phone) return [];
    if (!result.name)
      throw new VendorError("VALIDATION", "Isi nama untuk setiap PIC.");
    if (result.email && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(result.email))
      throw new VendorError("VALIDATION", "Isi satu email yang valid per PIC.");
    return [result];
  });
}
