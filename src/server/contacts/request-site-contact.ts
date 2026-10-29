import "server-only";
import type { PoolClient } from "pg";
import type { Person } from "@/types/identity";
import type { PrototypeRequest, RequestDraft } from "@/types/prototype";
import { VendorError } from "@/lib/domain/vendor-master";
import {
  canSelectInternalContact,
  internalContactIds,
  internalContactLabel,
} from "@/lib/domain/internal-contacts";
import { InternalContactsRepository } from "./repository";

/** Called inside the existing booking transaction, after command-receipt replay. */
export async function resolveRequestSiteContact(
  client: PoolClient,
  draft: RequestDraft,
  actor: Person,
  previous?: Pick<PrototypeRequest, "siteContactInternalId" | "siteContact">,
): Promise<RequestDraft> {
  if (draft.siteContactInternalId === undefined) return draft;
  const [id] = internalContactIds([draft.siteContactInternalId]);
  if (!canSelectInternalContact(actor)) {
    // An existing requester may retain the submitted contact after losing a role.
    // No directory read or new selection is granted by this historical reference.
    if (
      previous?.siteContactInternalId === id &&
      previous.siteContact === draft.siteContact
    )
      return { ...draft, siteContactInternalId: id };
    throw new VendorError(
      "FORBIDDEN",
      "Only StoreDev or Super Admin can select an internal Request PIC.",
    );
  }
  const [contact] = await new InternalContactsRepository(client).resolve([id]);
  return {
    ...draft,
    siteContactInternalId: id,
    siteContact: internalContactLabel(contact),
  };
}
