"use client";
import { useEffect, useState, useRef } from "react";
import { Button, Input } from "@heroui/react";
import { HeroSelect } from "@/components/shared/hero-select";
import type { UploadDraftPhoto } from "@/lib/asset-registration-client";
function Preview({ file }: { file: File }) {
  const preview = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (preview.current) preview.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // Browser-owned File previews cannot use server image optimization.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={preview}
      alt="Selected asset photo preview"
      className="h-40 w-full rounded-xl object-contain"
    />
  );
}
export function AssetPhotoFields({
  value,
  onChange,
  disabled = false,
}: {
  value: UploadDraftPhoto[];
  onChange: (value: UploadDraftPhoto[]) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  const update = (index: number, change: Partial<UploadDraftPhoto>) =>
    onChange(
      value.map((p, i) =>
        i === index
          ? { ...p, ...change }
          : change.isPrimary
            ? { ...p, isPrimary: false }
            : p,
      ),
    );
  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-4">
      <legend className="mb-3 font-semibold">Asset photos</legend>
      <p className="text-muted text-sm">
        One primary Asset Photo is required. JPEG, PNG or WebP · up to 6 photos
        · 10 MiB/file · 30 MiB total · 40 MP. Photos do not confirm inspection.
      </p>
      <label className="grid gap-2">
        Choose photos
        <input
          aria-label="Choose asset photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled}
          className="w-full min-w-0 text-sm"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (
              value.length + files.length > 6 ||
              files.some((f) => f.size > 10 * 1024 * 1024) ||
              [...value.map((p) => p.file), ...files].reduce(
                (n, f) => n + f.size,
                0,
              ) >
                30 * 1024 * 1024
            ) {
              setError("Maximum 6 photos, 10 MiB per file and 30 MiB total.");
              return;
            }
            setError("");
            onChange([
              ...value,
              ...files.map((file, i) => ({
                file,
                partId: crypto.randomUUID(),
                category: "Asset" as const,
                isPrimary: !value.some((p) => p.isPrimary) && i === 0,
                view: "Front" as const,
                caption: "",
              })),
            ]);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {value.map((photo, index) => (
          <div
            key={photo.partId}
            className="border-border grid min-w-0 gap-3 rounded-xl border p-4"
          >
            <Preview file={photo.file} />
            <p className="truncate text-sm">{photo.file.name}</p>
            <HeroSelect
              label={`Photo ${index + 1} category`}
              value={photo.category}
              options={["Asset", "Condition"].map((v) => ({
                value: v,
                label: v + " Photo",
              }))}
              onChange={(v) =>
                update(index, {
                  category: v as "Asset" | "Condition",
                  isPrimary: v === "Asset" && photo.isPrimary,
                })
              }
            />
            <HeroSelect
              label={`Photo ${index + 1} view`}
              value={photo.view}
              options={[
                "Front",
                "Left side",
                "Right side",
                "Rear",
                "Detail",
                "Installed",
                "Other",
              ].map((v) => ({ value: v, label: v }))}
              onChange={(v) =>
                update(index, { view: v as UploadDraftPhoto["view"] })
              }
            />
            <label className="grid gap-2 text-sm">
              Caption (optional)
              <Input
                value={photo.caption}
                maxLength={2000}
                onChange={(e) => update(index, { caption: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="primary-asset-photo"
                checked={photo.isPrimary}
                disabled={disabled || photo.category !== "Asset"}
                onChange={() => update(index, { isPrimary: true })}
              />
              Primary Asset Photo
            </label>
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => onChange(value.filter((_, i) => i !== index))}
            >
              Remove photo {index + 1}
            </Button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
