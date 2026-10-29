import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  internalContactDraft,
  internalContactIds,
  type InternalContact,
} from "@/lib/domain/internal-contacts";
import type { AssetContact } from "@/lib/domain/asset-contacts";
import { VendorError } from "@/lib/domain/vendor-master";

const projection = "id,name,email,phone,active,source";
export const contactKey = (draft: AssetContact) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        draft.name.trim().replace(/\s+/g, " ").toLowerCase(),
        draft.email.trim().toLowerCase(),
        draft.phone.trim(),
      ]),
    )
    .digest("hex");
export class InternalContactsRepository {
  private readonly client: PoolClient;
  constructor(client: PoolClient) {
    this.client = client;
  }
  async list(): Promise<InternalContact[]> {
    return (
      await this.client.query(
        `select ${projection} from contact_core.internal_contacts where active order by name,id`,
      )
    ).rows;
  }
  async create(
    value: unknown,
    actorId: string,
    source: InternalContact["source"] = "manual",
  ) {
    const draft = internalContactDraft(value);
    const key = contactKey(draft);
    const inserted = await this.client.query<InternalContact>(
      `insert into contact_core.internal_contacts(id,name,email,phone,dedupe_key,source,created_by) values($1,$2,$3,$4,$5,$6,$7) on conflict(dedupe_key) do nothing returning ${projection}`,
      [
        randomUUID(),
        draft.name,
        draft.email,
        draft.phone,
        key,
        source,
        actorId,
      ],
    );
    const contact =
      inserted.rows[0] ??
      (
        await this.client.query<InternalContact>(
          `select ${projection} from contact_core.internal_contacts where dedupe_key=$1`,
          [key],
        )
      ).rows[0];
    if (!contact?.active)
      throw new VendorError(
        "CONFLICT",
        "Kontak identik sudah nonaktif; hubungi pengelola data.",
      );
    if (inserted.rowCount && source === "manual")
      await this.client.query(
        "insert into contact_core.audit_events(id,actor_user_id,action,contact_id,summary) values($1,$2,'CREATE_CONTACT',$3,$4::jsonb)",
        [
          randomUUID(),
          actorId,
          contact.id,
          JSON.stringify({ fields: ["name", "email", "phone"], source }),
        ],
      );
    return { contact, created: !!inserted.rowCount };
  }
  async resolve(ids: string[]): Promise<InternalContact[]> {
    ids = internalContactIds(ids);
    if (!ids.length) return [];
    const rows = (
      await this.client.query<InternalContact>(
        `select ${projection} from contact_core.internal_contacts where id=any($1::uuid[]) and active for share`,
        [ids],
      )
    ).rows;
    if (rows.length !== ids.length)
      throw new VendorError(
        "VALIDATION",
        "PIC tidak ditemukan atau sudah nonaktif. Pilih ulang dari daftar.",
      );
    return ids.map((id) => rows.find((c) => c.id === id)!);
  }
  async linked(assetId: string): Promise<InternalContact[]> {
    return (
      await this.client.query<InternalContact>(
        `select c.id,c.name,c.email,c.phone,c.active,c.source from contact_core.asset_management_contacts a join contact_core.internal_contacts c on c.id=a.contact_id where a.asset_id=$1 order by a.position`,
        [assetId],
      )
    ).rows;
  }
  async replace(assetId: string, ids: string[], actorId: string) {
    const contacts = await this.resolve(ids);
    await this.client.query(
      "delete from contact_core.asset_management_contacts where asset_id=$1",
      [assetId],
    );
    for (const [position, id] of ids.entries())
      await this.client.query(
        "insert into contact_core.asset_management_contacts(asset_id,contact_id,position,assigned_by) values($1,$2,$3,$4)",
        [assetId, id, position, actorId],
      );
    return contacts;
  }
}
