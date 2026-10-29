import { actorFetch } from "./actor-client";
import type { RegistrationIntent } from "./domain/asset-registration";
import type { Asset, AssetPhotoView } from "@/types/prototype";
export type UploadDraftPhoto = {
  partId: string;
  file: File;
  category: "Asset" | "Condition";
  isPrimary: boolean;
  view: AssetPhotoView;
  caption: string;
  replacesId?: string;
};
export class AssetCommandError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function photoForm(
  intent: unknown,
  photos: UploadDraftPhoto[],
  registration: boolean,
) {
  const form = new FormData();
  const specs = photos.map(({ file: _file, ...spec }) => spec);
  const root = intent as Record<string, unknown>;
  form.set(
    "intent",
    JSON.stringify(
      registration
        ? { ...root, asset: { ...(root.asset as object), photos: specs } }
        : { ...root, photos: specs },
    ),
  );
  for (const photo of photos) form.append(photo.partId, photo.file);
  return form;
}
export async function saveRegistration(
  intent: RegistrationIntent,
  photos: UploadDraftPhoto[],
) {
  const response = await actorFetch("/api/assets", {
    method: "POST",
    body: photoForm(intent, photos, true),
  });
  const result = await response.json();
  if (!response.ok)
    throw new AssetCommandError(
      response.status,
      result.error?.code ?? result.code ?? "UNEXPECTED",
      result.error?.code ?? result.message ?? "Registration failed.",
    );
  return result.asset as Asset;
}
export async function saveDocumentation(
  id: string,
  intent: { commandKey: string; revision: string },
  photos: UploadDraftPhoto[],
) {
  const response = await actorFetch(
    `/api/assets/${encodeURIComponent(id)}/photos`,
    { method: "POST", body: photoForm(intent, photos, false) },
  );
  const result = await response.json();
  if (!response.ok)
    throw new AssetCommandError(
      response.status,
      result.error?.code ?? result.code ?? "UNEXPECTED",
      result.error?.code ?? result.message ?? "Documentation failed.",
    );
  return result.asset as Asset;
}
