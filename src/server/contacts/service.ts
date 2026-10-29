import "server-only";
import pg from "pg";
import { operationalVendorActor } from "@/lib/server/vendors";
import { VendorError } from "@/lib/domain/vendor-master";
import { InternalContactsRepository } from "./repository";
import { canSelectInternalContact } from "@/lib/domain/internal-contacts";

const pool = new pg.Pool({
  connectionString: process.env.ASSETHUB_DATABASE_URL,
  max: 3,
});
export async function requireAssetContactActor(request: Request) {
  const actor = await operationalVendorActor(request);
  // Same approved directory visibility for Asset and Request selectors.
  if (!canSelectInternalContact(actor))
    throw new VendorError(
      "FORBIDDEN",
      "Only StoreDev or Super Admin can select or add internal contacts.",
    );
  return actor;
}
export async function listInternalContacts(request: Request) {
  await requireAssetContactActor(request);
  const client = await pool.connect();
  try {
    return await new InternalContactsRepository(client).list();
  } finally {
    client.release();
  }
}
export async function createInternalContact(request: Request) {
  const actor = await requireAssetContactActor(request);
  // Trusted resolver enforces the configured origin and loopback listener before this point.
  if (
    !request.headers.get("origin") ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new VendorError(
      "FORBIDDEN",
      "A same-origin browser request is required.",
    );
  const input = await request.json();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await new InternalContactsRepository(client).create(
      input,
      actor.id,
    );
    await client.query("commit");
    return result.contact;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
