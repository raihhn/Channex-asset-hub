"use client";

import { Button, Input } from "@heroui/react";
import type { AssetContact } from "@/lib/domain/asset-contacts";

export function AssetContactFields({
  value,
  onChange,
  disabled = false,
}: {
  value: AssetContact[];
  onChange: (contacts: AssetContact[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, key: keyof AssetContact, text: string) =>
    onChange(
      value.map((contact, i) =>
        i === index ? { ...contact, [key]: text } : contact,
      ),
    );
  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-4">
      <legend className="mb-3 font-semibold">PIC pengelola asset</legend>
      <p className="text-muted text-sm">
        Satu nama dan kontak per PIC. Ini tidak membuat akun atau mengubah PIC
        peminjaman.
      </p>
      {value.map((contact, index) => (
        <div
          key={index}
          className="border-border grid min-w-0 gap-3 rounded-xl border p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">PIC {index + 1}</span>
            <Button
              type="button"
              size="sm"
              variant="tertiary"
              isDisabled={disabled}
              aria-label={`Hapus PIC ${index + 1}`}
              onPress={() => onChange(value.filter((_, i) => i !== index))}
            >
              Hapus
            </Button>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <label className="grid min-w-0 gap-2">
              Nama PIC {index + 1}
              <Input
                maxLength={250}
                value={contact.name}
                onChange={(e) => update(index, "name", e.target.value)}
              />
            </label>
            <label className="grid min-w-0 gap-2">
              Email PIC {index + 1}
              <Input
                type="email"
                maxLength={250}
                value={contact.email}
                onChange={(e) => update(index, "email", e.target.value)}
              />
            </label>
            <label className="grid min-w-0 gap-2">
              Telepon PIC {index + 1}
              <Input
                type="tel"
                maxLength={250}
                value={contact.phone}
                onChange={(e) => update(index, "phone", e.target.value)}
              />
            </label>
          </div>
        </div>
      ))}
      <Button
        className="w-fit"
        type="button"
        variant="secondary"
        isDisabled={disabled || value.length >= 50}
        onPress={() => onChange([...value, { name: "", email: "", phone: "" }])}
      >
        Tambah PIC
      </Button>
    </fieldset>
  );
}
