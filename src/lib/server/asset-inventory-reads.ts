import "server-only";
import { signedMediaUrl } from "./assets";
import pg from "pg";
import { operationalVendorActor } from "./vendors";
import { VendorError } from "@/lib/domain/vendor-master";
const pool = new pg.Pool({
  connectionString: process.env.ASSETHUB_DATABASE_URL,
  max: 3,
});
async function selectorActor(request: Request) {
  const actor = await operationalVendorActor(request);
  if (!actor.roles.some((r) => r === "STORE_DEV" || r === "SUPER_ADMIN"))
    throw new VendorError(
      "FORBIDDEN",
      "Asset selectors require StoreDev or Super Admin.",
    );
  return actor;
}
export async function registrationGroups(request: Request) {
  await selectorActor(request);
  if (
    !(
      await pool.query(
        "select to_regclass('asset_master.asset_groups') as installed",
      )
    ).rows[0].installed
  )
    return [];
  return (
    await pool.query(
      `select g.id,g.name,g.version,g.owner_contact_id as "ownerContactId",g.managing_contact_id as "managingContactId",o.name as "ownerName",p.name as "picName",(select count(*)::int from asset_master.asset_group_memberships m where m.group_id=g.id) as "memberCount" from asset_master.asset_groups g join contact_core.internal_contacts o on o.id=g.owner_contact_id join contact_core.internal_contacts p on p.id=g.managing_contact_id where o.active and p.active order by g.name,g.id`,
    )
  ).rows;
}
export async function registrationLocations(request: Request) {
  await selectorActor(request);
  return (
    await pool.query(
      `select id,name,address,'Internal warehouse' as type,null::uuid as "vendorId",''::text as contact from asset_master.internal_warehouses union all select w.id::text,v.name || ' — ' || w.name,w.address,'Vendor warehouse',v.id,coalesce((select string_agg(c.name || ' · ' || c.phone,' / ' order by c.name) from vendor_master.warehouse_contacts wc join vendor_master.contacts c on c.id=wc.contact_id where wc.warehouse_id=w.id and c.active),'') from vendor_master.warehouses w join vendor_master.vendors v on v.id=w.vendor_id where w.active and w.address_verified order by name`,
    )
  ).rows;
}
export async function assetHistory(request: Request, id: string) {
  await operationalVendorActor(request);
  const old = (
    await pool.query(
      "select payload,source from asset_master.assets where id=$1",
      [id],
    )
  ).rows[0];
  if (!old) throw new VendorError("NOT_FOUND", "Asset not found.");
  const audits = (
    await pool.query(
      "select id,action,occurred_at,actor_user_id,changes from asset_master.audit_events where asset_id=$1 order by occurred_at desc,id desc",
      [id],
    )
  ).rows;
  const titles: Record<string, string> = {
    REGISTER_ASSET: "Asset registered",
    EDIT_METADATA: "Informasi / Owner / PIC diperbarui",
    SOURCE_LOCATION_CONFIRMED: "Koreksi data lokasi",
    DOCUMENTATION_UPDATED: "Dokumentasi diperbarui",
  };
  const documentationInstalled = (
    await pool.query(
      "select to_regclass('asset_master.asset_photos') as installed",
    )
  ).rows[0]?.installed;
  const documentation = documentationInstalled
    ? (
        await pool.query(
          "select id,object_key,superseded_at,revision,predecessor_id from asset_master.asset_photos where asset_id=$1 order by created_at,id",
          [id],
        )
      ).rows
    : [];
  const history = audits
    .filter((a) => titles[a.action])
    .map((a) => ({
      id: a.id,
      date: new Date(a.occurred_at).toISOString(),
      title: titles[a.action],
      detail:
        a.action === "REGISTER_ASSET"
          ? `Assignment: ${a.changes.assignmentSource ?? "asset"}${a.changes.groupId ? " · group " + a.changes.groupId : ""}`
          : a.action === "SOURCE_LOCATION_CONFIRMED"
            ? "Koreksi pencatatan; bukan bukti perpindahan fisik."
            : a.action === "DOCUMENTATION_UPDATED"
              ? `${a.changes.photoIds?.length ?? 0} foto tersimpan; evidence lama dipertahankan.`
              : "Perubahan metadata tercatat; tidak mengubah kondisi atau readiness.",
      kind:
        a.action === "DOCUMENTATION_UPDATED"
          ? "Documentation"
          : a.action === "REGISTER_ASSET"
            ? "Registration"
            : a.action === "SOURCE_LOCATION_CONFIRMED"
              ? "Correction"
              : "Metadata",
      source: "audit",
      actorId: a.actor_user_id,
      evidence:
        a.action === "DOCUMENTATION_UPDATED" || a.action === "REGISTER_ASSET"
          ? documentation
              .filter(
                (p) =>
                  (a.changes.photoIds ?? []).includes(p.id) ||
                  documentation.some(
                    (n) =>
                      (a.changes.photoIds ?? []).includes(n.id) &&
                      n.predecessor_id === p.id,
                  ),
              )
              .map((p) => ({
                url: signedMediaUrl(p.object_key),
                label: `Photo revision ${p.revision}${p.superseded_at ? " (historical)" : ""}`,
              }))
          : [],
    }));
  const imported = Boolean(old.payload.importInfo);
  const legacy = (old.payload.history ?? [])
    .filter(
      (e: { title: string }) =>
        !(
          (e.title ?? "").startsWith("Asset registered") &&
          audits.some((a) => a.action === "REGISTER_ASSET")
        ),
    )
    .map(
      (
        e: { date: string; title: string; detail: string; kind?: string },
        i: number,
      ) => ({
        ...e,
        id: `payload-${i}`,
        source: imported && /import/i.test(e.title) ? "source" : "payload",
        kind: imported && /import/i.test(e.title) ? "Import" : e.kind,
      }),
    );
  const events = history.map((event) => {
    const audit = audits.find((a) => a.id === event.id);
    if (!audit || event.kind !== "Documentation") return event;
    const sourcePhotos = (old.payload.photos ?? []).filter(
      (p: { id: string; objectKey?: string }) =>
        p.objectKey && (audit.changes.replacedIds ?? []).includes(p.id),
    );
    return {
      ...event,
      evidence: [
        ...event.evidence,
        ...sourcePhotos.map((p: { objectKey: string }) => ({
          url: signedMediaUrl(p.objectKey),
          label: "Original imported evidence (preserved)",
        })),
      ],
    };
  });
  return [...events, ...legacy];
}
