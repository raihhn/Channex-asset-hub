"use client";

import { useState } from "react";
import { Button, Input } from "@heroui/react";
import type {
  RequestDocument,
  RequestDocumentCategory,
} from "@/types/prototype";

export function MovementLetterField({
  category,
  value,
  onChange,
  onReadingChange,
}: {
  category: RequestDocumentCategory;
  value: RequestDocument[];
  onChange: (value: RequestDocument[]) => void;
  onReadingChange: (reading: boolean) => void;
}) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="border-border bg-surface-secondary grid gap-2 rounded-xl border border-dashed p-4">
      <label className="grid gap-2 text-sm font-medium">
        {category}
        <Input
          aria-label={`Upload ${category}`}
          className="w-full min-w-0"
          type="file"
          multiple
          accept="application/pdf,image/*"
          disabled={reading}
          onChange={async (event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (!files.length) return;
            if (
              value.length + files.length > 5 ||
              files.some(
                (file) =>
                  !file.size ||
                  file.size > 5 * 1024 * 1024 ||
                  !(
                    file.type === "application/pdf" ||
                    file.type.startsWith("image/")
                  ),
              )
            ) {
              setError("Use up to five PDF/image files, 5 MB each.");
              return;
            }
            setError("");
            setReading(true);
            onReadingChange(true);
            try {
              const documents = await Promise.all(
                files.map(async (file): Promise<RequestDocument> => ({
                  id: crypto.randomUUID(),
                  category,
                  name: file.name,
                  size: file.size,
                  mimeType: file.type,
                  dataUrl: await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () =>
                      typeof reader.result === "string"
                        ? resolve(reader.result)
                        : reject(new Error("Could not read file."));
                    reader.onerror = () =>
                      reject(new Error("Could not read file."));
                    reader.readAsDataURL(file);
                  }),
                })),
              );
              onChange([...value, ...documents]);
            } catch {
              setError("Could not read the selected files.");
            } finally {
              setReading(false);
              onReadingChange(false);
            }
          }}
        />
      </label>
      <p className="text-muted text-xs">
        One set of letters for this shipment. PDF/image, 5 MB each. Files remain
        in this prototype session.
      </p>
      {value.map((document) => (
        <div
          className="flex items-center justify-between gap-2 text-xs"
          key={document.id}
        >
          <a
            href={document.dataUrl}
            className="text-accent min-w-0 break-words"
            target="_blank"
            rel="noreferrer"
          >
            {document.name}
          </a>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={reading}
            aria-label={`Remove ${document.name}`}
            onPress={() =>
              onChange(value.filter((file) => file.id !== document.id))
            }
          >
            Remove
          </Button>
        </div>
      ))}
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
