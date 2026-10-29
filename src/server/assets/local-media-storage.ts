import "server-only";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { PoolClient } from "pg";
import { VendorError } from "@/lib/domain/vendor-master";
import type { AssetPhotoView } from "@/types/prototype";
export const mediaRoot = () =>
  path.resolve(
    process.env.ASSETHUB_ASSET_MEDIA_ROOT ??
      path.join(process.cwd(), ".local/asset-media"),
  );
export class MediaError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type PhotoSpec = {
  partId: string;
  category: "Asset" | "Condition";
  isPrimary: boolean;
  view: AssetPhotoView;
  caption: string;
  replacesId?: string;
};
export type VerifiedPhoto = PhotoSpec & {
  bytes: Buffer;
  key: string;
  mime: string;
};
export type PreparedMedia = { photos: VerifiedPhoto[]; fingerprint: string };
function invalid(message: string): never {
  throw new VendorError("VALIDATION", message);
}
export async function requireDocumentationSchema(
  client: Pick<PoolClient, "query">,
) {
  if (
    !(
      await client.query(
        "select to_regclass('asset_master.asset_photos') as installed",
      )
    ).rows[0]?.installed
  )
    throw new VendorError(
      "DISABLED",
      "Inventory registration awaits isolated verification and approved active migration.",
    );
}
/** Limit raw request consumption even when Content-Length is missing or forged. */
export async function parsePhotoUpload(
  request: Request,
  registration: boolean,
) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new MediaError(415, "Use multipart image upload.");
  const limit = 31 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit)
    throw new MediaError(413, "Upload request is too large.");
  const reader = request.body?.getReader();
  if (!reader) invalid("Upload body required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new MediaError(413, "Upload request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    invalid("Invalid multipart upload.");
  }
  const json = form.getAll("intent");
  if (
    json.length !== 1 ||
    typeof json[0] !== "string" ||
    json[0].length > 65536
  )
    invalid("One bounded registration intent required.");
  let intent: Record<string, unknown>;
  try {
    intent = JSON.parse(json[0]) as Record<string, unknown>;
  } catch {
    invalid("Invalid upload intent.");
  }
  if (!intent || Array.isArray(intent) || typeof intent !== "object")
    invalid("Invalid upload intent.");
  const asset = registration
    ? (intent.asset as Record<string, unknown>)
    : intent;
  if (
    !asset ||
    typeof asset !== "object" ||
    !Array.isArray(asset.photos) ||
    asset.photos.length < 1 ||
    asset.photos.length > 6
  )
    invalid("Upload one to six actual photos.");
  const photos: VerifiedPhoto[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const raw of asset.photos) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      invalid("Invalid photo metadata.");
    const spec = {
      ...raw,
      caption: (raw as PhotoSpec).caption ?? "",
    } as PhotoSpec;
    if (
      Object.keys(spec).some(
        (k) =>
          ![
            "partId",
            "category",
            "isPrimary",
            "view",
            "caption",
            "replacesId",
          ].includes(k),
      ) ||
      !/^[a-zA-Z0-9_-]{1,50}$/.test(spec.partId) ||
      seen.has(spec.partId) ||
      !["Asset", "Condition"].includes(spec.category) ||
      typeof spec.isPrimary !== "boolean" ||
      ![
        "Front",
        "Left side",
        "Right side",
        "Rear",
        "Detail",
        "Installed",
        "Other",
      ].includes(spec.view) ||
      typeof spec.caption !== "string" ||
      spec.caption.length > 2000 ||
      (spec.isPrimary && spec.category !== "Asset") ||
      (spec.replacesId !== undefined &&
        (typeof spec.replacesId !== "string" || spec.replacesId.length > 250))
    )
      invalid("Invalid photo category, view or caption.");
    if (registration && spec.replacesId)
      invalid("New registration cannot replace existing evidence.");
    seen.add(spec.partId);
    const parts = form.getAll(spec.partId);
    const file = parts[0];
    if (
      parts.length !== 1 ||
      typeof file === "string" ||
      !file ||
      file.size < 1
    )
      invalid("Actual image bytes required.");
    total += file.size;
    if (file.size > 10 * 1024 * 1024 || total > 30 * 1024 * 1024)
      throw new MediaError(413, "Photo limit: 10 MiB per file, 30 MiB total.");
    const bytes = Buffer.from(await file.arrayBuffer());
    let format: string | undefined;
    try {
      const decoder = sharp(bytes, {
        limitInputPixels: 40000000,
        failOn: "warning",
        animated: false,
      });
      const info = await decoder.metadata();
      format = info.format;
      if (
        !["jpeg", "png", "webp"].includes(format ?? "") ||
        (info.pages ?? 1) > 1 ||
        !info.width ||
        !info.height ||
        info.width * info.height > 40000000
      )
        throw Error();
      await decoder.stats();
    } catch {
      throw new MediaError(
        415,
        "Image must decode as JPEG, PNG or WebP, single frame, at most 40 MP.",
      );
    }
    photos.push({
      ...spec,
      caption: spec.caption.trim(),
      bytes,
      key: createHash("sha256").update(bytes).digest("hex") + "." + format,
      mime: format === "jpeg" ? "image/jpeg" : `image/${format}`,
    });
  }
  if ([...form.keys()].some((k) => k !== "intent" && !seen.has(k)))
    invalid("Unknown multipart field.");
  if (
    registration &&
    photos.filter((p) => p.isPrimary && p.category === "Asset").length !== 1
  )
    invalid("Choose exactly one primary Asset Photo.");
  if (photos.filter((p) => p.isPrimary).length > 1)
    invalid("Choose only one primary image.");
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(photos.map(({ bytes: _bytes, ...p }) => p)))
    .digest("hex");
  const { photos: _photos, ...draft } = asset;
  return {
    input: registration ? { ...intent, asset: draft } : draft,
    media: { photos, fingerprint } satisfies PreparedMedia,
  };
}
/** Bytes publish before SQL references. Failures retain safe orphan files and a
 * private manifest; no destructive final-object cleanup is ever automatic. */
export async function persistPhotos(
  client: PoolClient,
  assetId: string,
  media: PreparedMedia,
  actorId: string,
  legacyPhotos: Array<{ id: string; objectKey?: string }> = [],
) {
  const root = mediaRoot();
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const area = path.join(path.dirname(root), "asset-upload-staging");
  await fs.mkdir(area, { recursive: true, mode: 0o700 });
  const staging = await fs.mkdtemp(path.join(area, "upload-"));
  const manifests = path.join(path.dirname(root), "asset-upload-manifests");
  await fs.mkdir(manifests, { recursive: true, mode: 0o700 });
  const manifest = path.join(manifests, randomUUID() + ".json");
  const keys = [...new Set(media.photos.map((p) => p.key))].sort();
  const evidence = {
    assetId,
    keys,
    created: [] as string[],
    state: "prepared-or-uncommitted",
  };
  const ids: string[] = [];
  try {
    await fs.writeFile(manifest, JSON.stringify(evidence), {
      mode: 0o600,
      flag: "wx",
    });
    for (const key of keys)
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1,0))",
        ["assethub:media:" + key],
      );
    for (const photo of media.photos) {
      const temp = path.join(staging, randomUUID());
      const handle = await fs.open(temp, "wx", 0o600);
      try {
        await handle.writeFile(photo.bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await fs.link(temp, path.join(root, photo.key));
        evidence.created.push(photo.key);
        await fs.writeFile(manifest, JSON.stringify(evidence), { mode: 0o600 });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        if ((await fs.lstat(path.join(root, photo.key))).isSymbolicLink())
          throw Error("Media symlinks are forbidden.");
        const existing = await fs.readFile(path.join(root, photo.key));
        if (!existing.equals(photo.bytes))
          throw Error("Stored object digest collision.");
      }
      const directory = await fs.open(root, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
      await client.query(
        "insert into asset_master.media(object_key,mime_type,byte_size) values($1,$2,$3) on conflict(object_key) do nothing",
        [photo.key, photo.mime, photo.bytes.length],
      );
      const stored = (
        await client.query(
          "select mime_type,byte_size from asset_master.media where object_key=$1",
          [photo.key],
        )
      ).rows[0];
      if (
        stored.mime_type !== photo.mime ||
        stored.byte_size !== photo.bytes.length
      )
        throw Error("Registered object metadata mismatch.");
      await client.query(
        "insert into asset_master.asset_media(asset_id,object_key,source_cell) values($1,$2,null) on conflict(asset_id,object_key) do nothing",
        [assetId, photo.key],
      );
      let predecessor: string | null = null,
        source: string | null = null,
        revision = 1;
      if (photo.replacesId) {
        const old = (
          await client.query(
            "select id,revision,is_primary from asset_master.asset_photos where asset_id=$1 and id::text=$2 and superseded_at is null for update",
            [assetId, photo.replacesId],
          )
        ).rows[0];
        if (old) {
          predecessor = old.id;
          revision = old.revision + 1;
          await client.query(
            "update asset_master.asset_photos set superseded_at=clock_timestamp() where id=$1",
            [old.id],
          );
          if (old.is_primary && !photo.isPrimary)
            invalid("Primary replacement must remain a primary Asset Photo.");
        } else {
          if (!legacyPhotos.some((p) => p.id === photo.replacesId))
            invalid("Original photo not found.");
          source = photo.replacesId;
        }
      }
      if (photo.isPrimary && !photo.replacesId) {
        const old = (
          await client.query(
            "select id,revision from asset_master.asset_photos where asset_id=$1 and is_primary and superseded_at is null for update",
            [assetId],
          )
        ).rows[0];
        if (old) {
          predecessor = old.id;
          revision = old.revision + 1;
        }
      }
      if (photo.isPrimary)
        await client.query(
          "update asset_master.asset_photos set superseded_at=clock_timestamp() where asset_id=$1 and is_primary and superseded_at is null",
          [assetId],
        );
      const id = randomUUID();
      await client.query(
        "insert into asset_master.asset_photos(id,asset_id,object_key,category,view,caption,is_primary,revision,predecessor_id,replaces_source_id,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          id,
          assetId,
          photo.key,
          photo.category,
          photo.view,
          photo.caption,
          photo.isPrimary,
          revision,
          predecessor,
          source,
          actorId,
        ],
      );
      ids.push(id);
    }
    return ids;
  } finally {
    await fs.rm(staging, { recursive: true });
  }
}
