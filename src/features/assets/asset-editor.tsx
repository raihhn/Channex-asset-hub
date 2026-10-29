"use client";
import { useState } from "react";
import { Button, Card, Input, TextArea } from "@heroui/react";
import {
  isLocalSessionError,
  localIdentityMessage,
  selectDevelopmentPerson,
} from "@/lib/actor-client";
import { WorkflowDisclosure } from "@/components/shared/workflow-disclosure";
import { RegistrationMetadataFields } from "./registration-metadata-fields";
import { AssetContactPicker } from "./asset-contact-picker";
import { Pencil } from "lucide-react";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { assetEditDefaults } from "@/lib/domain/asset-edit";
import type { Asset } from "@/types/prototype";

export function AssetEditor({ asset }: { asset: Asset }) {
  const { currentUser, editAsset } = usePrototype();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => assetEditDefaults(asset));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canEdit = currentUser.roles.some((role) =>
    ["STORE_DEV", "SUPER_ADMIN"].includes(role),
  );
  const detail = (key: keyof typeof draft.details, value: string) =>
    setDraft((current) => ({
      ...current,
      details: { ...current.details, [key]: value },
    }));
  return (
    <section className="mb-6 grid gap-4" aria-label="Asset editing">
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted text-sm">
            Perbarui informasi utama dan PIC pengelola asset.
          </p>
          <Button
            variant="secondary"
            isDisabled={busy}
            aria-expanded={open}
            aria-controls="asset-edit-form"
            onPress={() => {
              setDraft(assetEditDefaults(asset));
              setError("");
              setOpen(!open);
            }}
          >
            <Pencil size={16} aria-hidden="true" />
            Edit asset
          </Button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {open && canEdit && (
        <Card className="border-border border p-4 sm:p-6">
          <Card.Header>
            <Card.Title>Edit asset</Card.Title>
            <Card.Description>
              {asset.catalogRevision
                ? asset.importInfo
                  ? "Perubahan disimpan ke database. Data sumber Excel tetap dipertahankan."
                  : "Perubahan disimpan ke database."
                : "Asset prototype: perubahan hanya berlaku pada sesi ini."}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <form
              id="asset-edit-form"
              className="grid gap-6"
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  await editAsset(asset.id, draft);
                  setOpen(false);
                  setMessage(
                    asset.catalogRevision
                      ? "Data asset tersimpan di database."
                      : "Data asset diperbarui untuk sesi ini.",
                  );
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Gagal menyimpan asset.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset
                disabled={busy}
                className="grid min-w-0 gap-4 sm:grid-cols-2"
              >
                <p className="text-muted text-sm sm:col-span-2">Nomor asset: {asset.assetNumber || "Belum tersedia"} · dibuat otomatis dan tidak dapat diubah.</p>
                <legend className="mb-3 font-semibold">
                  Identitas dan penanggung jawab
                </legend>
                <label className="grid min-w-0 gap-2">
                  Nama asset
                  <Input
                    required
                    maxLength={250}
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </label>
                <label className="grid min-w-0 gap-2">
                  Nomor asset lama / referensi (opsional)
                  <Input
                    value={draft.legacyReference ?? asset.legacyReference ?? ""}
                    maxLength={250}
                    onChange={(e) =>
                      setDraft({ ...draft, legacyReference: e.target.value })
                    }
                  />
                </label>
              </fieldset>
              {!asset.managementContactIds?.length &&
                !asset.managementContacts?.length &&
                (asset.responsiblePic || draft.details.picEmail) && (
                  <div className="bg-surface-secondary grid min-w-0 gap-2 rounded-xl p-4 text-sm">
                    <p className="font-medium">Kontak lama (referensi)</p>
                    <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                      {asset.responsiblePic}
                    </p>
                    <p className="[overflow-wrap:anywhere]">
                      {draft.details.picEmail || asset.importInfo?.picEmail}
                    </p>
                    <p>
                      Pilih PIC dari daftar kontak internal di bawah. Jika belum
                      tersedia, tambahkan kontak sekali ke daftar. Pasangan
                      nama/email tidak ditebak; teks lama dipertahankan.
                    </p>
                  </div>
                )}
              {asset.assetGroup ? (
                <p className="bg-surface-secondary rounded-xl p-4 text-sm">
                  Owner/PIC inherited from Asset Group {asset.assetGroup.name}.
                  Group assignments cannot be changed here.
                </p>
              ) : (
                <>
                  <AssetContactPicker
                    label="Owner asset"
                    single
                    value={draft.ownerContactId ? [draft.ownerContactId] : []}
                    selectedContacts={
                      asset.ownerContact ? [asset.ownerContact] : []
                    }
                    disabled={busy}
                    onChange={(ids) =>
                      setDraft((current) => {
                        const next = { ...current };
                        if (ids[0]) next.ownerContactId = ids[0];
                        else delete next.ownerContactId;
                        return next;
                      })
                    }
                  />
                  <AssetContactPicker
                    value={draft.managementContactIds ?? []}
                    selectedContacts={draft.managementContacts}
                    disabled={busy}
                    onChange={(managementContactIds, managementContacts) =>
                      setDraft((current) => ({
                        ...current,
                        managementContactIds,
                        managementContacts,
                      }))
                    }
                  />
                </>
              )}
              <RegistrationMetadataFields
                value={draft.registrationMetadata ?? {}}
                onChange={(registrationMetadata) =>
                  setDraft({ ...draft, registrationMetadata })
                }
              />
              <WorkflowDisclosure title="Struktur asset (opsional)">
                <p className="text-muted text-sm">
                  Jelaskan apakah record ini mewakili asset utuh atau satu
                  komponen mandiri. Informasi penggunaan event dicatat melalui
                  aktivitas asset, terpisah dari data utama ini.
                </p>
                <fieldset
                  disabled={busy}
                  className="grid min-w-0 gap-4 sm:grid-cols-2"
                >
                  <legend className="mb-3 font-semibold">
                    Utuh atau komponen
                  </legend>
                  <HeroSelect
                    isDisabled={busy}
                    label="Record ini mewakili"
                    value={draft.details.composition}
                    onChange={(v) => detail("composition", v)}
                    options={[
                      { value: "Unconfirmed", label: "Belum diketahui" },
                      { value: "Whole", label: "Satu asset utuh" },
                      { value: "Component", label: "Satu komponen mandiri" },
                    ]}
                  />
                  <label className="grid min-w-0 gap-2">
                    Catatan bagian / isi asset
                    <Input
                      placeholder="Contoh: booth utuh, atau Wall A dari Totem Skybridge"
                      value={draft.details.compositionNotes}
                      onChange={(e) =>
                        detail("compositionNotes", e.target.value)
                      }
                    />
                  </label>
                  <p className="text-muted text-sm sm:col-span-2">
                    Contoh: Booth Custom 6×6 dicatat sebagai satu asset utuh.
                    Wall A yang bisa dipindah sendiri dicatat sebagai satu
                    komponen. Pilihan ini hanya menjelaskan record, tidak
                    memecah atau menggabungkan asset.
                  </p>
                </fieldset>
              </WorkflowDisclosure>
              <label className="grid gap-2">
                Keterangan asset
                <TextArea
                  maxLength={2000}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <p className="text-muted text-sm">
                Lokasi, jumlah stok, kondisi, dan kesiapan barang tetap
                mengikuti proses operasional dan inspeksi.
              </p>
              {error && (
                <div className="border-border grid gap-3 rounded-xl border p-4">
                  <p role="alert" className="text-danger">
                    {isLocalSessionError(error)
                      ? "Sesi lokal tidak aktif atau sudah berakhir. Perubahan belum tersimpan; isian form tetap ada."
                      : localIdentityMessage(error)}
                  </p>
                  {isLocalSessionError(error) && currentUser.id && (
                    <Button
                      type="button"
                      variant="secondary"
                      isDisabled={busy}
                      onPress={async () => {
                        setBusy(true);
                        try {
                          // Explicit re-selection of the same actor only. Do not
                          // refresh the provider or remount this unsaved editor.
                          await selectDevelopmentPerson(currentUser.id);
                          setError("");
                          setMessage(
                            "Sesi aktif kembali. Isian tetap ada; tekan Simpan perubahan untuk menyimpan.",
                          );
                        } catch (failure) {
                          setError(
                            failure instanceof Error
                              ? failure.message
                              : "Gagal mengaktifkan sesi lokal.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Aktifkan kembali sesi sebagai {currentUser.name}
                    </Button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="tertiary"
                  isDisabled={busy}
                  onPress={() => setOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" isDisabled={busy}>
                  {busy ? "Menyimpan…" : "Simpan perubahan"}
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>
      )}
    </section>
  );
}
