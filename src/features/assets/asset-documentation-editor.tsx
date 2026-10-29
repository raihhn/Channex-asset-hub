"use client";
import { useRef, useState } from "react";
import { Button, Card } from "@heroui/react";
import { HeroSelect } from "@/components/shared/hero-select";
import { AssetPhotoFields } from "./asset-photo-fields";
import {
  saveDocumentation,
  AssetCommandError,
  type UploadDraftPhoto,
} from "@/lib/asset-registration-client";
import { localIdentityMessage, readLocalApi } from "@/lib/actor-client";
import { usePrototype } from "@/features/prototype/prototype-provider";
import type { Asset } from "@/types/prototype";
export function AssetDocumentationEditor({ asset }: { asset: Asset }) {
  const { currentUser } = usePrototype();
  const [reloadedAsset, setReloadedAsset] = useState<Asset | null>(null);
  const revision = reloadedAsset?.catalogRevision ?? asset.catalogRevision;
  const availablePhotos = reloadedAsset?.photos ?? asset.photos;
  const [stale, setStale] = useState(false);
  const [photos, setPhotos] = useState<UploadDraftPhoto[]>([]),
    [replaceId, setReplaceId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [locked, setLocked] = useState(false);
  const submission = useRef<{
    intent: { commandKey: string; revision: string };
    photos: UploadDraftPhoto[];
  } | null>(null);
  if (!currentUser.roles.some((r) => r === "STORE_DEV" || r === "SUPER_ADMIN"))
    return null;
  return (
    <Card className="mb-6 grid min-w-0 gap-4 p-4 sm:p-6">
      <Card.Header>
        <Card.Title>Asset documentation</Card.Title>
        <Card.Description>
          Private images. Replacements retain earlier evidence; photos do not
          confirm an inspection.
        </Card.Description>
      </Card.Header>
      <Card.Content className="grid min-w-0 gap-4">
        <Button
          className="w-fit"
          variant="secondary"
          onPress={() => setOpen(!open)}
          isDisabled={busy || locked}
        >
          Add / replace photos
        </Button>
        {open && (
          <>
            <fieldset disabled={busy || locked} className="grid min-w-0 gap-4">
              <HeroSelect
                label="Replace an existing image (optional)"
                placeholder="Add new documentation"
                value={replaceId}
                onChange={setReplaceId}
                options={[
                  { value: "", label: "Add new documentation" },
                  ...availablePhotos.map((p, i) => ({
                    value: p.id,
                    label: `Photo ${i + 1} · ${p.category ?? "Asset"} · ${p.caption || p.view}`,
                  })),
                ]}
              />
              <AssetPhotoFields value={photos} onChange={setPhotos} />
              <p className="text-muted text-sm">
                A new primary replaces the current main image in this gallery.
                Earlier versions remain available through Asset History.
              </p>
            </fieldset>
            {error && (
              <p role="alert" className="text-danger">
                {localIdentityMessage(error)}
              </p>
            )}
            {stale && (
              <Button
                variant="secondary"
                onPress={async () => {
                  try {
                    const loaded = await readLocalApi<{ assets: Asset[] }>(
                      "/api/assets",
                    );
                    const current = loaded.assets.find(
                      (a) => a.id === asset.id,
                    );
                    if (!current) throw Error("Asset no longer available");
                    setReloadedAsset(current);
                    setReplaceId("");
                    submission.current = null;
                    setLocked(false);
                    setStale(false);
                    setError(
                      "Current asset version loaded. Selected files are retained; review and save explicitly.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Reload asset version; keep selected files
              </Button>
            )}
            <Button
              isPending={busy}
              isDisabled={busy || stale || !revision || !photos.length}
              onPress={async () => {
                setBusy(true);
                setError("");
                try {
                  if (!submission.current)
                    submission.current = {
                      intent: {
                        commandKey: crypto.randomUUID(),
                        revision: revision!,
                      },
                      photos: photos.map((p, i) => ({
                        ...p,
                        ...(i === 0 && replaceId
                          ? { replacesId: replaceId }
                          : {}),
                      })),
                    };
                  setLocked(true);
                  await saveDocumentation(
                    asset.id,
                    submission.current.intent,
                    submission.current.photos,
                  );
                  window.location.reload();
                } catch (e) {
                  setError((e as Error).message);
                  if (e instanceof AssetCommandError && e.code === "STALE")
                    setStale(true);
                  if (
                    e instanceof AssetCommandError &&
                    [400, 413, 415].includes(e.status)
                  ) {
                    submission.current = null;
                    setLocked(false);
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              {locked ? "Retry same documentation save" : "Save documentation"}
            </Button>
          </>
        )}
      </Card.Content>
    </Card>
  );
}
