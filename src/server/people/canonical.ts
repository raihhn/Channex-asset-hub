import "server-only";
import pg from "pg";
import { PeopleRepository } from "./repository";
import { ActorResolutionError } from "@/server/auth/actor-context";

// Explicit development selection allowlist, independent of fixture profile data.
export const developmentPersonIds = [
  "dev-user",
  "user-storedev",
  "user-brand",
  "user-vendor",
  "user-management",
] as const;
const pool = new pg.Pool({
  connectionString: process.env.ASSETHUB_DATABASE_URL,
  max: 5,
});
function configured() {
  try {
    const url = new URL(process.env.ASSETHUB_DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      throw new Error();
  } catch {
    throw new ActorResolutionError(503, "CANONICAL_PEOPLE_UNAVAILABLE");
  }
}
export async function findCanonicalPerson(id: string) {
  configured();
  const client = await pool.connect();
  try {
    return (await new PeopleRepository(client).get(id))?.person ?? null;
  } finally {
    client.release();
  }
}
export async function requireCanonicalPerson(id: string) {
  const person = await findCanonicalPerson(id);
  if (!person || person.status !== "ACTIVE")
    throw new ActorResolutionError(401, "CANONICAL_PERSON_UNAVAILABLE");
  return person;
}
/** Contact-free projections only. No email, organizational scope or identity links. */
export async function canonicalPersonChoices(developmentOnly: boolean) {
  configured();
  const { rows } = await pool.query(
    "select id,name,status,roles from identity_core.people where status='ACTIVE' and (not $1::boolean or id=any($2::text[])) order by name,id",
    [developmentOnly, developmentPersonIds],
  );
  return rows as Pick<
    import("@/types/identity").Person,
    "id" | "name" | "status" | "roles"
  >[];
}
