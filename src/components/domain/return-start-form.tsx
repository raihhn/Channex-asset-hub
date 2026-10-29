"use client";

import { useState } from "react";
import { Button, Input } from "@heroui/react";
import type { RequestDocument } from "@/types/prototype";

export function ReturnStartForm({
  onStart,
}: {
  onStart: (letters: RequestDocument[]) => void;
}) {
  const [letters, setLetters] = useState<RequestDocument[]>([]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  return (
    <div className="border-border grid gap-3 rounded-xl border p-4">
      <label className="grid gap-2 text-sm font-medium">
        Loading-out letter (optional)
        <Input
          type="file"
          accept="application/pdf,image/*"
          multiple
          disabled={reading}
          aria-label="Upload Loading-out letter"
          className="w-full min-w-0"
          onChange={async (event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (!files.length) return;
            if (
              files.length + letters.length > 5 ||
              files.some(
                (file) =>
                  file.size > 5 * 1024 * 1024 ||
                  !(
                    file.type === "application/pdf" ||
                    file.type.startsWith("image/")
                  ),
              )
            ) {
              setError("Use up to 5 PDF or image files, 5 MB each.");
              return;
            }
            setReading(true);
            setError("");
            try {
              const documents = await Promise.all(
                files.map(async (file) => ({
                  id: crypto.randomUUID(),
                  category: "Loading-out letter" as const,
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
              setLetters((current) => [...current, ...documents]);
            } catch {
              setError("Could not read the selected files.");
            } finally {
              setReading(false);
            }
          }}
        />
      </label>
      <p className="text-muted text-xs">
        Attach the loading-out letter when preparing the return. PDF or image, 5
        MB each. Files stay in this browser session.
      </p>
      {letters.map((letter) => (
        <div
          key={letter.id}
          className="flex items-center justify-between gap-2 text-xs"
        >
          <a
            href={letter.dataUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            {letter.name}
          </a>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Remove ${letter.name}`}
            onPress={() =>
              setLetters((current) =>
                current.filter((item) => item.id !== letter.id),
              )
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
      <Button
        isDisabled={reading}
        onPress={() => {
          try {
            onStart(letters);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not start return.",
            );
          }
        }}
      >
        Start Return
      </Button>
    </div>
  );
}
