"use client";
import { Input, TextArea } from "@heroui/react";
import type { RegistrationMetadata } from "@/lib/domain/asset-registration";
export function RegistrationMetadataFields({
  value,
  onChange,
}: {
  value: RegistrationMetadata;
  onChange: (value: RegistrationMetadata) => void;
}) {
  return (
    <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
      <legend className="mb-3 font-semibold">
        Supporting metadata (optional)
      </legend>
      <label className="grid gap-2">
        Received date
        <Input
          type="date"
          value={value.receivedDate ?? ""}
          onChange={(e) => onChange({ ...value, receivedDate: e.target.value })}
        />
      </label>
      <label className="grid gap-2">
        Event / project reference
        <Input
          maxLength={2000}
          value={value.eventProjectReference ?? ""}
          onChange={(e) =>
            onChange({ ...value, eventProjectReference: e.target.value })
          }
        />
      </label>
      <label className="grid gap-2">
        Informational asset value
        <Input
          inputMode="decimal"
          value={value.assetValue?.amount ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              assetValue: e.target.value
                ? {
                    amount: e.target.value,
                    currency: value.assetValue?.currency ?? "",
                  }
                : null,
            })
          }
        />
      </label>
      <label className="grid gap-2">
        Currency (explicit code, e.g. IDR)
        <Input
          maxLength={3}
          value={value.assetValue?.currency ?? ""}
          disabled={!value.assetValue}
          onChange={(e) =>
            onChange({
              ...value,
              assetValue: {
                amount: value.assetValue?.amount ?? "",
                currency: e.target.value.toUpperCase(),
              },
            })
          }
        />
      </label>
      <label className="grid gap-2 sm:col-span-2">
        Additional notes
        <TextArea
          maxLength={2000}
          value={value.additionalNotes ?? ""}
          onChange={(e) =>
            onChange({ ...value, additionalNotes: e.target.value })
          }
        />
      </label>
      <p className="text-muted text-sm sm:col-span-2">
        Received date is metadata, not physical receipt. An event reference does
        not record usage. Value is informational; no currency or production date
        is inferred.
      </p>
    </fieldset>
  );
}
