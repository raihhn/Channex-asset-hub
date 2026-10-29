import { validateAssetContacts, type AssetContact } from "./asset-contacts";
import { VendorError } from "./vendor-master";
import type { Asset } from "@/types/prototype";
import type { Person } from "@/types/identity";

/** Directory visibility/selection, not a grant to perform operational commands. */
export function canSelectInternalContact(actor: Pick<Person, "roles">) {
  return actor.roles.some((role) => role === "STORE_DEV" || role === "SUPER_ADMIN");
}

export function internalContactLabel(contact: AssetContact) {
  return [contact.name, contact.phone, contact.email].filter(Boolean).join(" · ");
}

export type InternalContact = AssetContact & {
  id: string;
  active: boolean;
  source: "manual" | "catalog-import";
};
export function internalContactDraft(value: unknown): AssetContact {
  const contacts = validateAssetContacts([value]);
  if (!contacts.length)
    throw new VendorError("VALIDATION", "Isi nama kontak internal.");
  return contacts[0];
}
export function internalContactIds(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some(
      (id) =>
        typeof id !== "string" ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          id,
        ),
    ) ||
    new Set(value.map((id) => (typeof id === "string" ? id.toLowerCase() : id)))
      .size !== value.length
  )
    throw new VendorError(
      "VALIDATION",
      "Pilih PIC dari daftar kontak internal tanpa duplikasi.",
    );
  return value.map((id) => id.toLowerCase());
}
const normalized = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const emails = (s: string) =>
  s
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(normalized);
const groupKey = (name: string, mail: string[]) =>
  JSON.stringify([normalized(name), [...mail].sort()]);

/** Explicit saved pairs may resolve an identical legacy group. Never split names by words. */
export function catalogContactCandidates(assets: Asset[]) {
  const known = new Map<string, AssetContact[]>();
  const conflicting = new Set<string>();
  for (const asset of assets) {
    if (!asset.managementContacts?.length) continue;
    const contacts = validateAssetContacts(asset.managementContacts);
    const key = groupKey(
      contacts.map((c) => c.name).join(" "),
      contacts.map((c) => normalized(c.email)).filter(Boolean),
    );
    const prior = known.get(key);
    if (prior && JSON.stringify(prior) !== JSON.stringify(contacts))
      conflicting.add(key);
    else known.set(key, contacts);
  }
  return assets.map((asset) => {
    if (asset.managementContacts !== undefined)
      return {
        assetId: asset.id,
        contacts: validateAssetContacts(asset.managementContacts),
        reason: "explicit-pairs",
      };
    const name = asset.responsiblePic?.trim() ?? "";
    const mail = emails(
      asset.details?.picEmail ?? asset.importInfo?.picEmail ?? "",
    );
    const key = groupKey(name, mail);
    const confirmed = !conflicting.has(key) && known.get(key);
    if (confirmed)
      return {
        assetId: asset.id,
        contacts: confirmed,
        reason: "confirmed-identical-group",
      };
    if (!name || mail.length !== 1 || /[\n,;&/]|\sdan\s|\sand\s/i.test(name))
      return {
        assetId: asset.id,
        contacts: [] as AssetContact[],
        reason: "needs-confirmation",
      };
    try {
      return {
        assetId: asset.id,
        contacts: [internalContactDraft({ name, email: mail[0], phone: "" })],
        reason: "single-contact",
      };
    } catch {
      return {
        assetId: asset.id,
        contacts: [] as AssetContact[],
        reason: "needs-confirmation",
      };
    }
  });
}
