import "server-only";
import type { PoolClient } from "pg";
import type { Asset, AssetPhoto, AssetPhotoView } from "@/types/prototype";
export async function projectAssetDocumentation(
  client: Pick<PoolClient, "query">,
  assets: Asset[],
  signed: (key: string) => string,
): Promise<Asset[]> {
  if (
    !(
      await client.query(
        "select to_regclass('asset_master.asset_photos') as installed",
      )
    ).rows[0]?.installed
  )
    return assets;
  const rows = (
    await client.query<{
      id: string;
      asset_id: string;
      object_key: string;
      category: "Asset" | "Condition";
      view: AssetPhotoView;
      caption: string;
      is_primary: boolean;
      revision: number;
      replaces_source_id: string | null;
      superseded_at: Date | null;
    }>(
      "select * from asset_master.asset_photos where asset_id=any($1::text[]) order by created_at,id",
      [assets.map((a) => a.id)],
    )
  ).rows;
  return assets.map((asset) => {
    const all = rows.filter((r) => r.asset_id === asset.id);
    if (!all.length) return asset;
    const replaced = new Set(
      all.flatMap((p) => (p.replaces_source_id ? [p.replaces_source_id] : [])),
    );
    const fresh: AssetPhoto[] = all
      .filter((p) => !p.superseded_at)
      .map((p) => ({
        id: p.id,
        view: p.view,
        caption: p.caption,
        required: false,
        objectKey: p.object_key,
        url: signed(p.object_key),
        category: p.category,
        isPrimary: p.is_primary,
        revision: p.revision,
      }));
    const existing = asset.photos.filter((p) => !replaced.has(p.id));
    return {
      ...asset,
      photos: [
        ...fresh.filter((p) => p.isPrimary),
        ...existing,
        ...fresh.filter((p) => !p.isPrimary),
      ],
    };
  });
}
