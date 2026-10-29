"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@heroui/react";
import { HeroSelect } from "@/components/shared/hero-select";
import {
  actorFetch,
  readLocalApi,
  localIdentityMessage,
} from "@/lib/actor-client";
import {
  internalContactDraft,
  type InternalContact,
} from "@/lib/domain/internal-contacts";
import type { AssetContact } from "@/lib/domain/asset-contacts";

export function AssetContactPicker({
  value,
  onChange,
  selectedContacts = [],
  disabled = false,
  single = false,
  label = "PIC pengelola tetap",
}: {
  value: string[];
  onChange: (ids: string[], contacts: AssetContact[]) => void;
  selectedContacts?: AssetContact[];
  disabled?: boolean;
  single?: boolean;
  label?: string;
}) {
  const [choices, setChoices] = useState<InternalContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AssetContact>({
    name: "",
    email: "",
    phone: "",
  });
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setChoices(
        await readLocalApi<InternalContact[]>("/api/internal-contacts"),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Daftar kontak belum dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    readLocalApi<InternalContact[]>("/api/internal-contacts")
      .then((list) => {
        if (active) setChoices(list);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Daftar kontak belum dapat dimuat.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const known = new Map<string, AssetContact>();
  for (const contact of selectedContacts)
    if (contact.id) known.set(contact.id, contact);
  for (const contact of choices) known.set(contact.id, contact);
  const update = (ids: string[], additional?: InternalContact) => {
    const next = additional
      ? new Map(known).set(additional.id, additional)
      : known;
    onChange(
      ids,
      ids.flatMap((id) => (next.has(id) ? [next.get(id)!] : [])),
    );
  };
  return (
    <fieldset disabled={disabled || busy} className="grid min-w-0 gap-4">
      <legend className="mb-3 font-semibold">{label}</legend>
      <p className="text-muted text-sm">
        {single
          ? "Pilih satu kontak internal."
          : "Pilih satu atau beberapa kontak internal."}{" "}
        Email dan telepon mengikuti daftar kontak; ini tidak membuat akun atau
        mengganti owner asset.
      </p>
      {error && (
        <div className="grid gap-2">
          <p role="alert" className="text-danger">
            {localIdentityMessage(error)}
          </p>
          <Button
            type="button"
            className="w-fit"
            variant="tertiary"
            isDisabled={loading}
            onPress={() => void load()}
          >
            Muat ulang kontak
          </Button>
        </div>
      )}
      <HeroSelect
        label={single ? `Cari ${label}` : "Cari PIC internal"}
        placeholder={
          loading
            ? "Memuat kontak internal…"
            : single
              ? "Cari nama atau email kontak…"
              : "Cari nama atau email PIC…"
        }
        isDisabled={disabled || busy || loading || !!error}
        value=""
        options={choices
          .filter((c) => c.active && !value.includes(c.id))
          .map((c) => ({
            value: c.id,
            label: [c.name, c.email, c.phone].filter(Boolean).join(" · "),
          }))}
        onChange={(id) => update(single ? [id] : [...value, id])}
      />
      <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
        {value.map((id, index) => {
          const contact = known.get(id);
          return (
            <li
              key={id}
              className="border-border grid min-w-0 gap-2 rounded-xl border p-4 [overflow-wrap:anywhere]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted text-sm">
                  {single ? label : `PIC ${index + 1}`}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="tertiary"
                  isDisabled={disabled || busy}
                  aria-label={`Lepas PIC ${contact?.name ?? index + 1}`}
                  onPress={() => update(value.filter((v) => v !== id))}
                >
                  Lepas
                </Button>
              </div>
              <p className="font-medium">
                {contact?.name ?? "Kontak belum dapat ditampilkan"}
              </p>
              <p>{contact?.email || "Email belum diisi"}</p>
              <p>{contact?.phone || "Telepon belum diisi"}</p>
              {contact?.active === false && (
                <p className="text-danger text-sm">
                  Kontak nonaktif — pilih PIC pengganti sebelum menyimpan.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {!creating ? (
        <Button
          className="w-fit"
          type="button"
          variant="secondary"
          isDisabled={disabled || loading || !!error}
          onPress={() => setCreating(true)}
        >
          Tambah kontak internal baru
        </Button>
      ) : (
        <div className="border-border grid min-w-0 gap-4 rounded-xl border p-4">
          <p className="font-medium">Kontak internal baru</p>
          <p className="text-muted text-sm">
            Simpan ke daftar agar bisa dipilih asset lain. Ini langsung
            menyimpan kontak; penugasannya ke asset baru tersimpan saat Simpan
            perubahan atau Register asset.
          </p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <label className="grid min-w-0 gap-2">
              Nama kontak
              <Input
                maxLength={250}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="grid min-w-0 gap-2">
              Email kontak
              <Input
                type="email"
                maxLength={250}
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </label>
            <label className="grid min-w-0 gap-2">
              Telepon kontak
              <Input
                type="tel"
                maxLength={250}
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="tertiary"
              isDisabled={busy || disabled}
              onPress={() => setCreating(false)}
            >
              Batal tambah kontak
            </Button>
            <Button
              type="button"
              variant="secondary"
              isDisabled={busy || disabled}
              onPress={async () => {
                setBusy(true);
                setError("");
                try {
                  const response = await actorFetch("/api/internal-contacts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(internalContactDraft(draft)),
                  });
                  const result = await response.json();
                  if (!response.ok)
                    throw Error(
                      result.error?.code ??
                        result.message ??
                        "Gagal menyimpan kontak internal.",
                    );
                  const contact = result as InternalContact;
                  setChoices((current) => [
                    ...current.filter((c) => c.id !== contact.id),
                    contact,
                  ]);
                  update(
                    value.includes(contact.id) ? value : [...value, contact.id],
                    contact,
                  );
                  setCreating(false);
                  setDraft({ name: "", email: "", phone: "" });
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Gagal menyimpan kontak internal.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Menyimpan kontak…" : "Simpan kontak ke daftar"}
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
