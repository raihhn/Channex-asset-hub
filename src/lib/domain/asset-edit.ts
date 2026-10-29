import {
  validateRegistrationMetadata,
  type RegistrationMetadata,
} from "./asset-registration";
import { validateVendorId } from "./vendor-master";
import { internalContactIds } from "./internal-contacts";
import { validateAssetContacts, type AssetContact } from "./asset-contacts";
import type { Asset } from "@/types/prototype";
import { VendorError } from "@/lib/domain/vendor-master";

export type AssetDetails = {
  ownerName: string;
  ownerEmail: string;
  picEmail: string;
  eventName: string;
  setupName: string;
  reference: string;
  composition: "Unconfirmed" | "Whole" | "Component";
  compositionNotes: string;
  confirmedDate: string;
  dateMeaning: "Unconfirmed" | "Event" | "Received" | "Used";
};
export type AssetEdit = {
  ownerContactId?: string;
  registrationMetadata?: RegistrationMetadata;
  legacyReference?: string;
  managementContactIds?: string[];
  managementContacts?: AssetContact[];
  name: string;
  description: string;
  responsiblePic: string;
  details: AssetDetails;
};
const emailPattern = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
function sourceEmails(value = "") {
  const emails = value
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean);
  // Concatenated/ambiguous source contacts remain evidence, not guessed corrections.
  return emails.every((email) => emailPattern.test(email))
    ? emails.join(", ")
    : "";
}
export function assetEditDefaults(asset: Asset): AssetEdit {
  return {
    ...(asset.ownerContactId ? { ownerContactId: asset.ownerContactId } : {}),
    ...(asset.registrationMetadata
      ? { registrationMetadata: asset.registrationMetadata }
      : {}),
    ...(asset.legacyReference !== undefined
      ? { legacyReference: asset.legacyReference }
      : {}),
    ...(asset.managementContactIds !== undefined
      ? { managementContactIds: asset.managementContactIds }
      : {}),
    managementContacts: asset.managementContacts ?? [],
    name: asset.name,
    description: asset.description,
    responsiblePic: asset.responsiblePic ?? "",
    details: asset.details ?? {
      ownerName: asset.importInfo?.ownerName ?? "",
      ownerEmail: sourceEmails(asset.importInfo?.ownerEmail),
      picEmail: sourceEmails(asset.importInfo?.picEmail),
      eventName: asset.importInfo?.eventName ?? "",
      setupName: asset.importInfo?.setupName ?? "",
      reference: asset.importInfo?.reference ?? "",
      composition: "Unconfirmed",
      compositionNotes: "",
      confirmedDate: "",
      dateMeaning: "Unconfirmed",
    },
  };
}
export function validateAssetEdit(input: unknown): AssetEdit {
  if (!input || typeof input !== "object")
    throw new VendorError("VALIDATION", "Invalid asset details.");
  const value = input as AssetEdit;
  const text = (s: unknown, limit = 2000) => {
    if (typeof s !== "string" || s.length > limit)
      throw new VendorError("VALIDATION", "Invalid or excessively long field.");
    return s.trim();
  };
  const name = text(value.name, 250);
  if (!name) throw new VendorError("VALIDATION", "Asset name is required.");
  const d = value.details;
  if (
    !d ||
    !["Unconfirmed", "Whole", "Component"].includes(d.composition) ||
    !["Unconfirmed", "Event", "Received", "Used"].includes(d.dateMeaning)
  )
    throw new VendorError(
      "VALIDATION",
      "Choose a valid composition and date meaning.",
    );
  const details = { ...d };
  for (const key of Object.keys(
    assetEditDefaults({} as Asset).details,
  ) as (keyof AssetDetails)[]) {
    Object.assign(details, { [key]: text(d[key]) });
  }
  for (const key of ["ownerEmail", "picEmail"] as const) {
    const emails = details[key]
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
    if (emails.some((email) => !emailPattern.test(email)))
      throw new VendorError(
        "VALIDATION",
        "Enter valid email addresses, separated by commas.",
      );
    details[key] = emails.join(", ");
  }
  if (
    details.confirmedDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(details.confirmedDate) ||
      new Date(details.confirmedDate).toJSON()?.slice(0, 10) !==
        details.confirmedDate ||
      details.dateMeaning === "Unconfirmed")
  )
    throw new VendorError(
      "VALIDATION",
      "Provide a valid date and its meaning.",
    );
  if (!details.confirmedDate && details.dateMeaning !== "Unconfirmed")
    throw new VendorError("VALIDATION", "Enter the confirmed date.");
  // Explicit allowlist: operational fields and original import evidence cannot be changed here.
  return {
    ...(value.ownerContactId !== undefined
      ? { ownerContactId: validateVendorId(value.ownerContactId) }
      : {}),
    ...(value.registrationMetadata !== undefined
      ? {
          registrationMetadata: validateRegistrationMetadata(
            value.registrationMetadata,
          ),
        }
      : {}),
    ...(value.legacyReference !== undefined
      ? { legacyReference: text(value.legacyReference, 250) }
      : {}),
    ...(value.managementContactIds !== undefined
      ? { managementContactIds: internalContactIds(value.managementContactIds) }
      : {}),
    ...(value.managementContacts !== undefined
      ? { managementContacts: validateAssetContacts(value.managementContacts) }
      : {}),
    name,
    description: text(value.description),
    responsiblePic: text(value.responsiblePic, 500),
    details: {
      ownerName: details.ownerName,
      ownerEmail: details.ownerEmail,
      picEmail: details.picEmail,
      eventName: details.eventName,
      setupName: details.setupName,
      reference: details.reference,
      composition: details.composition,
      compositionNotes: details.compositionNotes,
      confirmedDate: details.confirmedDate,
      dateMeaning: details.dateMeaning,
    },
  };
}
