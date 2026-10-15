import "server-only";
import pg from "pg";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Asset } from "@/types/prototype";
import { operationalVendorActor } from "@/lib/server/vendors";
const pool = new pg.Pool({
  connectionString: process.env.ASSETHUB_DATABASE_URL,
  max: 3,
});
function signingKey() {
  const secret = process.env.ASSETHUB_MEDIA_SIGNING_KEY;
  if (!secret) throw new Error("Local media signing key is not configured.");
  return secret;
}
function signature(key: string, expires: string) {
  return createHmac("sha256", signingKey())
    .update(`${key}:${expires}`)
    .digest("hex");
}
export async function readAssetCatalog(request: Request) {
  operationalVendorActor(request);
  const { rows } = await pool.query<{ payload: Asset }>(
    "select payload from asset_master.assets order by case when payload->'importInfo'->>'sheet'='ALL BRAND (Storedev)' then 0 else 1 end, (payload->'importInfo'->>'row')::int",
  );
  const expires = String(Math.floor(Date.now() / 1000) + 86400);
  return rows.map(({ payload }) => ({
    ...payload,
    photos: payload.photos.map((photo) => ({
      ...photo,
      url: photo.objectKey
        ? `/api/assets/media/${photo.objectKey}?expires=${expires}&signature=${signature(photo.objectKey, expires)}`
        : photo.url,
    })),
  }));
}
/** Signed, same-origin, loopback-only local media adapter. Never a public filesystem path. */
export async function readAssetMedia(request: Request, key: string) {
  const url = new URL(request.url);
  const host = request.headers.get("host")?.split(":")[0];
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    (host && !["localhost", "127.0.0.1", "[::1]"].includes(host))
  )
    return new Response("Forbidden", { status: 403 });
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== url.origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return new Response("Forbidden", { status: 403 });
  if (!/^[a-f0-9]{64}\.(png|jpe?g|gif|webp)$/.test(key))
    return new Response("Not found", { status: 404 });
  const expires = url.searchParams.get("expires") ?? "",
    provided = url.searchParams.get("signature") ?? "";
  if (
    !/^\d+$/.test(expires) ||
    Number(expires) < Date.now() / 1000 ||
    !/^[a-f0-9]{64}$/.test(provided) ||
    !timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(signature(key, expires), "hex"),
    )
  )
    return new Response("Forbidden", { status: 403 });
  const { rows } = await pool.query(
    "select mime_type,byte_size from asset_master.media where object_key=$1",
    [key],
  );
  if (!rows[0]) return new Response("Not found", { status: 404 });
  const bytes = await readFile(
    path.join(process.cwd(), ".local", "asset-media", key),
  );
  return new Response(bytes, {
    headers: {
      "Content-Type": rows[0].mime_type,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function readInternalWarehouses(request: Request) {
  operationalVendorActor(request);
  const { rows } = await pool.query(
    "select id,name,address,'Internal warehouse' as type,'' as city from asset_master.internal_warehouses order by name",
  );
  return rows;
}
