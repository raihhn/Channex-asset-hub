import "server-only";
import { createHash, randomUUID } from "node:crypto";
import pg, { type Pool, type PoolClient } from "pg";
import {
  parsePhotoUpload,
  persistPhotos,
  requireDocumentationSchema,
  type PreparedMedia,
} from "@/server/assets/local-media-storage";
import {
  validateRegistrationIntent,
  type RegistrationIntent,
} from "@/lib/domain/asset-registration";
import { VendorError } from "@/lib/domain/vendor-master";
import { InternalContactsRepository } from "@/server/contacts/repository";
import { operationalVendorActor } from "./vendors";
import { readAssetCatalog } from "./assets";
import type { Asset } from "@/types/prototype";

const registrationPool = new pg.Pool({
  connectionString: process.env.ASSETHUB_DATABASE_URL,
  max: 5,
});
/** Photo validation and relational persistence are inseparable on the public path. */
export async function registerCatalogAsset(
  request: Request,
  _unused?: unknown,
) {
  const actor = await operationalVendorActor(request);
  if (!actor.roles.some((r) => r === "STORE_DEV" || r === "SUPER_ADMIN"))
    throw new VendorError(
      "FORBIDDEN",
      "Registration requires StoreDev or Super Admin.",
    );
  await requireDocumentationSchema(registrationPool);
  const upload = await parsePhotoUpload(request, true);
  return commitRegistration(
    request,
    upload.input,
    registrationPool,
    undefined,
    upload.media,
  );
}
export async function registerIsolatedRelationalAsset(
  request: Request,
  input: unknown,
  pool: Pool,
  ownershipToken: string,
) {
  return commitRegistration(request, input, pool, ownershipToken);
}

export async function assertIsolatedRegistrationTarget(
  client: Pick<PoolClient, "query">,
  ownershipToken: string,
) {
  if (!/^[a-f0-9]{48}$/.test(ownershipToken))
    throw new Error("Isolated registration ownership proof required.");
  const row = (
    await client.query<{
      name: string;
      version: number;
      ownership: string;
    }>(`select current_database() as name,current_setting('server_version_num')::int as version,
    shobj_description(oid,'pg_database') as ownership from pg_database where datname=current_database()`)
  ).rows[0];
  const configured = new URL(process.env.ASSETHUB_DATABASE_URL ?? "invalid:");
  if (
    !row ||
    !/^assethub_test_registration_[a-f0-9]{24}$/.test(row.name) ||
    Math.floor(row.version / 10000) !== 17 ||
    row.ownership !== `assethub:gate1:${ownershipToken}` ||
    !["localhost", "127.0.0.1", "[::1]"].includes(configured.hostname) ||
    configured.pathname !== `/${row.name}`
  ) {
    throw new Error(
      "Owned isolated PostgreSQL 17 registration target required; active database refused.",
    );
  }
}

async function location(
  client: PoolClient,
  input: RegistrationIntent["asset"]["location"],
) {
  if (input.kind === "internal") {
    const row = (
      await client.query<{ name: string; address: string }>(
        "select name,address from asset_master.internal_warehouses where id=$1 for share",
        [input.warehouseId],
      )
    ).rows[0];
    if (!row)
      throw new VendorError("VALIDATION", "Choose a valid internal warehouse.");
    return { ...row, type: "Internal warehouse" as const };
  }
  // T05: neither contact availability nor booking-destination eligibility is a gate.
  const row = (
    await client.query<{ name: string; address: string }>(
      `select v.name || ' — ' || w.name as name,w.address from vendor_master.warehouses w join vendor_master.vendors v on v.id=w.vendor_id
    where w.id=$1 and v.id=$2 and w.active and w.address_verified for share of w,v`,
      [input.warehouseId, input.vendorId],
    )
  ).rows[0];
  if (!row)
    throw new VendorError(
      "VALIDATION",
      "Choose an active verified warehouse belonging to the selected vendor.",
    );
  return { ...row, type: "Vendor warehouse" as const };
}

/** Explicit private Gate-1 contract. No route or UI imports this function. It can
 * write ONLY a generated, ownership-token-marked clone of the development DB.
 * Empty photos here are NOT stored documentation or an end-user registration. */
async function commitRegistration(
  request: Request,
  input: unknown,
  pool: Pool,
  ownershipToken?: string,
  media?: PreparedMedia,
) {
  const client = await pool.connect();
  let id = "",
    replayed = false;
  try {
    if (ownershipToken)
      await assertIsolatedRegistrationTarget(client, ownershipToken);
    else {
      await requireDocumentationSchema(client);
      if (!media?.photos.some((p) => p.isPrimary && p.category === "Asset"))
        throw new VendorError(
          "VALIDATION",
          "A real primary Asset Photo is required.",
        );
    }
    const actor = await operationalVendorActor(request);
    if (
      !actor.roles.some(
        (role) => role === "STORE_DEV" || role === "SUPER_ADMIN",
      )
    )
      throw new VendorError(
        "FORBIDDEN",
        "Only StoreDev or Super Admin can register assets.",
      );
    if (
      !request.headers.get("origin") ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      throw new VendorError("FORBIDDEN", "A same-origin request is required.");
    const intent = validateRegistrationIntent(input);
    const fingerprintVersion = media ? 2 : 1;
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify(
          media
            ? { version: 2, actor: actor.id, intent, media: media.fingerprint }
            : { version: 1, actor: actor.id, intent },
        ),
      )
      .digest("hex");
    await client.query("begin");
    await client.query("set local timezone='UTC'");
    await client.query("set local lock_timeout='3000ms'");
    await client.query("set local statement_timeout='15000ms'");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      `assethub:registration:${intent.commandKey}`,
    ]);
    const canonical = (
      await client.query<{ roles: string[] }>(
        "select roles from identity_core.people where id=$1 and status='ACTIVE' for share",
        [actor.id],
      )
    ).rows[0];
    if (
      !canonical?.roles.some(
        (role) => role === "STORE_DEV" || role === "SUPER_ADMIN",
      )
    )
      throw new VendorError(
        "FORBIDDEN",
        "Canonical registration actor is no longer eligible.",
      );
    const receipt = (
      await client.query<{
        actor_user_id: string;
        fingerprint: string;
        asset_id: string;
        fingerprint_version: number;
      }>(
        "select actor_user_id,fingerprint,asset_id,fingerprint_version from asset_master.registration_receipts where key=$1",
        [intent.commandKey],
      )
    ).rows[0];
    if (receipt) {
      if (
        receipt.actor_user_id !== actor.id ||
        receipt.fingerprint !== fingerprint ||
        receipt.fingerprint_version !== fingerprintVersion
      )
        throw new VendorError(
          "CONFLICT",
          "Registration key was reused with a different actor or intent.",
        );
      id = receipt.asset_id;
      replayed = true;
    } else {
      const a = intent.asset;
      let groupId: string | null = null,
        groupVersion = 1;
      let ownerId: string, picIds: string[];
      if (a.group.mode === "existing") {
        const group = (
          await client.query<{
            id: string;
            version: number;
            owner_contact_id: string;
            managing_contact_id: string;
          }>(
            "select id,version,owner_contact_id,managing_contact_id from asset_master.asset_groups where id=$1 for share",
            [a.group.id],
          )
        ).rows[0];
        if (!group) throw new VendorError("VALIDATION", "Group not found.");
        if (group.version !== a.group.expectedVersion)
          throw new VendorError(
            "STALE",
            "Reload the group before registering.",
          );
        groupId = group.id;
        groupVersion = group.version;
        ownerId = group.owner_contact_id;
        picIds = [group.managing_contact_id];
      } else if (a.group.mode === "create") {
        groupId = randomUUID();
        ownerId = a.group.ownerContactId;
        picIds = [a.group.managingContactId];
      } else {
        ownerId = a.ownerContactId!;
        picIds = a.managementContactIds!;
      }
      const selectedLocation = await location(client, a.location);
      const contacts = new InternalContactsRepository(client);
      // SQL ORDER BY (not array ordering) establishes the shared-contact lock order.
      await client.query(
        "select id from contact_core.internal_contacts where id=any($1::uuid[]) order by id for share",
        [[...new Set([ownerId, ...picIds])]],
      );
      // Resolve Owner separately: up to 50 PICs plus a different Owner is valid.
      const resolved = [
        ...new Map(
          [
            ...(await contacts.resolve([ownerId])),
            ...(await contacts.resolve(picIds)),
          ].map((contact) => [contact.id, contact]),
        ).values(),
      ];
      id = `asset-${randomUUID()}`;
      const now = (
        await client.query<{ now: string }>(
          "select clock_timestamp()::text as now",
        )
      ).rows[0].now;
      const payload: Asset & Record<string, unknown> = {
        id,
        code: id,
        name: a.name,
        brand: a.brand,
        category: a.category,
        classification: "ASSET",
        type: "Individual",
        trackingType: "Individual",
        supportsQuantity: false,
        warehouseId: a.location.warehouseId,
        ...(a.location.kind === "vendor"
          ? { vendorId: a.location.vendorId }
          : {}),
        location: selectedLocation.name,
        locationType: selectedLocation.type,
        locationDetail: selectedLocation.address,
        availability: "unavailable",
        condition: a.condition,
        inspectionState: "Inspection pending",
        totalQuantity: 1,
        availableQuantity: 1,
        unitPolicy: a.unitPolicy,
        producedAt: "",
        ageLabel: "Not recorded",
        lastUsed: "Not recorded",
        lastUsedContext: "",
        description: a.description,
        artwork: "kit",
        tone: "teal",
        photos: [],
        issues: [],
        history: [
          {
            date: new Date(now).toISOString(),
            title: media
              ? "Asset registered"
              : "Asset registered (isolated relational verification)",
            detail: media
              ? "Private asset documentation saved. Physical inspection pending."
              : "Physical inspection and photo persistence are not confirmed.",
          },
        ],
        legacyReference: a.legacyReference,
        conditionNotes: a.conditionNotes,
        registrationMetadata: a.metadata,
        registrationProvenance: {
          kind: "manual",
          actorId: actor.id,
          registeredAt: new Date(now).toISOString(),
          documentationState: media
            ? "documented-inspection-pending"
            : "gate1-isolated-no-media",
        },
      };
      await client.query(
        "insert into asset_master.assets(id,source_key,source_hash,vendor_id,warehouse_id,internal_warehouse_id,payload,source) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)",
        [
          id,
          `manual:${id}`,
          fingerprint,
          a.location.kind === "vendor" ? a.location.vendorId : null,
          a.location.kind === "vendor" ? a.location.warehouseId : null,
          a.location.kind === "internal" ? a.location.warehouseId : null,
          JSON.stringify(payload),
          JSON.stringify({
            kind: "manual",
            schemaVersion: 1,
            actorId: actor.id,
            registeredAt: now,
            commandKey: intent.commandKey,
            isolatedRelationalVerification: !media,
          }),
        ],
      );
      if (a.group.mode === "create")
        await client.query(
          "insert into asset_master.asset_groups(id,name,owner_contact_id,managing_contact_id,created_by,updated_by) values($1,$2,$3,$4,$5,$5)",
          [groupId, a.group.name, ownerId, picIds[0], actor.id],
        );
      if (groupId)
        await client.query(
          "insert into asset_master.asset_group_memberships(asset_id,group_id,joined_by) values($1,$2,$3)",
          [id, groupId, actor.id],
        );
      else {
        await client.query(
          "insert into contact_core.asset_owner_contacts(asset_id,contact_id,assigned_by) values($1,$2,$3)",
          [id, ownerId, actor.id],
        );
        await contacts.replace(id, picIds, actor.id);
      }
      await client.query(
        "insert into booking.assets(id,category,classification,tracking_type,availability_hint,inspection_hold,available_quantity) values($1,$2,'ASSET','Individual','unavailable',true,1)",
        [id, a.category],
      );
      const photoIds = media
        ? await persistPhotos(client, id, media, actor.id)
        : [];
      await client.query(
        "insert into asset_master.audit_events(asset_id,actor_user_id,action,changes) values($1,$2,'REGISTER_ASSET',$3::jsonb)",
        [
          id,
          actor.id,
          JSON.stringify({
            commandKey: intent.commandKey,
            registrationMode: a.group.mode,
            photoIds,
            groupId,
            groupVersion: groupId ? groupVersion : null,
            assignmentSource: groupId ? "group" : "asset",
            ownerContactId: ownerId,
            managementContactIds: picIds,
            location: a.location,
            condition: a.condition,
            availability: "unavailable",
            inspectionState: "Inspection pending",
            isolatedRelationalVerification: !media,
            contactIdsResolved: resolved.map((c) => c.id),
          }),
        ],
      );
      await client.query(
        "insert into asset_master.registration_receipts(key,actor_user_id,fingerprint,fingerprint_version,asset_id) values($1,$2,$3,$4,$5)",
        [intent.commandKey, actor.id, fingerprint, fingerprintVersion, id],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  const asset = (await readAssetCatalog(request)).find(
    (asset) => asset.id === id,
  );
  if (!asset)
    throw new Error(
      "Committed registration could not be retrieved; retry the same key.",
    );
  return { asset, replayed };
}
