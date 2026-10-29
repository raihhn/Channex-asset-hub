import "server-only";
import type { PoolClient } from "pg";
import type { Asset } from "@/types/prototype";
import type { InternalContact } from "@/lib/domain/internal-contacts";

export type RegistrationProjection = Asset & {
  ownerContactId?: string;
  ownerContact?: InternalContact;
  assignmentSource?: "asset" | "group";
  assetGroup?: {
    id: string;
    name: string;
    version: number;
    memberCount: number;
  };
};
/** Additive deployment compatibility: the active pre-0011 database remains readable.
 * Once the group schema exists, missing/inconsistent tables fail closed, never fixtures. */
export async function projectRegistrationRelationships(
  client: Pick<PoolClient, "query">,
  assets: Asset[],
): Promise<RegistrationProjection[]> {
  const installed = await client.query(
    "select to_regclass('asset_master.asset_groups') as installed",
  );
  if (!installed.rows[0].installed || !assets.length) return assets;
  const ids = assets.map((asset) => asset.id);
  const rows = (
    await client.query<{
      asset_id: string;
      group_id: string | null;
      group_name: string | null;
      version: number | null;
      member_count: string;
      owner_contact_id: string | null;
      owner: InternalContact | null;
      pic: InternalContact | null;
    }>(
      `select a.id as asset_id,g.id as group_id,g.name as group_name,g.version,
    (select count(*) from asset_master.asset_group_memberships x where x.group_id=g.id)::text as member_count,
    coalesce(g.owner_contact_id,o.contact_id) as owner_contact_id,
    case when c.id is not null then jsonb_build_object('id',c.id,'name',c.name,'email',c.email,'phone',c.phone,'active',c.active,'source',c.source) end as owner,
    case when p.id is not null then jsonb_build_object('id',p.id,'name',p.name,'email',p.email,'phone',p.phone,'active',p.active,'source',p.source) end as pic
    from asset_master.assets a
    left join asset_master.asset_group_memberships m on m.asset_id=a.id
    left join asset_master.asset_groups g on g.id=m.group_id
    left join contact_core.asset_owner_contacts o on o.asset_id=a.id
    left join contact_core.internal_contacts c on c.id=coalesce(g.owner_contact_id,o.contact_id)
    left join contact_core.internal_contacts p on p.id=g.managing_contact_id
    where a.id=any($1::text[])`,
      [ids],
    )
  ).rows;
  const byId = new Map(rows.map((row) => [row.asset_id, row]));
  return assets.map((asset) => {
    const row = byId.get(asset.id);
    if (!row || !row.owner_contact_id) return asset;
    return {
      ...asset,
      ownerContactId: row.owner_contact_id,
      ownerContact: row.owner!,
      assignmentSource: row.group_id ? "group" : "asset",
      ...(row.group_id
        ? {
            assetGroup: {
              id: row.group_id,
              name: row.group_name!,
              version: row.version!,
              memberCount: Number(row.member_count),
            },
            managementContactIds: [row.pic!.id],
            managementContacts: [row.pic!],
          }
        : {}),
    };
  });
}
