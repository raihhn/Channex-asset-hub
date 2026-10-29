import { WorkflowDisclosure } from "@/components/shared/workflow-disclosure";
import { Card } from "@heroui/react";
import { assetEditDefaults } from "@/lib/domain/asset-edit";
import type { Asset } from "@/types/prototype";
import { assetReference } from "@/lib/domain/asset-reference";

export function AssetMetadata({ asset }: { asset: Asset }) {
  if (!asset.details && !asset.importInfo && !asset.managementContacts)
    return null;
  const { details } = assetEditDefaults(asset);
  const fields = [
    [
      "Nomor asset",
      assetReference(asset),
    ],
    ["Nomor asset lama / referensi", asset.legacyReference || asset.importInfo?.sourceCode || (asset.code !== asset.id ? asset.code : undefined)],
    [
      "Asset Group",
      asset.assetGroup
        ? `${asset.assetGroup.name} · ${asset.assetGroup.memberCount} individual assets`
        : "Standalone / belum dikelompokkan",
    ],
    [
      "Quantity / UoM",
      `${asset.totalQuantity ?? "Unknown"} ${asset.unitPolicy?.stockUnit ?? asset.importInfo?.sourceUnit ?? "Unknown"}`,
    ],
    ["Owner asset", asset.ownerContact?.name || details.ownerName],
    ["Email owner", asset.ownerContact?.email || details.ownerEmail],
    ["Owner phone", asset.ownerContact?.phone],
    [
      "Sumber assignment",
      asset.assignmentSource === "group"
        ? `Asset Group: ${asset.assetGroup?.name}`
        : asset.ownerContactId
          ? "Asset ini"
          : "Legacy source / belum terhubung",
    ],
    ["Received date (metadata)", asset.registrationMetadata?.receivedDate],
    [
      "Event / project reference (metadata)",
      asset.registrationMetadata?.eventProjectReference,
    ],
    [
      "Informational asset value",
      asset.registrationMetadata?.assetValue
        ? `${asset.registrationMetadata.assetValue.amount} ${asset.registrationMetadata.assetValue.currency}`
        : undefined,
    ],
    ["Additional notes", asset.registrationMetadata?.additionalNotes],
    [
      "Registered",
      asset.registrationProvenance?.registeredAt
        ? new Date(asset.registrationProvenance.registeredAt).toLocaleString(
            "id-ID",
            { timeZone: "Asia/Jakarta" },
          )
        : undefined,
    ],
    [
      "Last updated",
      asset.catalogRevision
        ? new Date(asset.catalogRevision).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })
        : undefined,
    ],

    [
      "Pencatatan asset",
      {
        Whole: "Satu asset utuh",
        Component: "Satu komponen mandiri",
        Unconfirmed: "Belum dikonfirmasi",
      }[details.composition],
    ],
    ["Catatan bagian / isi asset", details.compositionNotes],
  ];
  return (
    <Card className="border-border mb-6 min-w-0 border p-4 sm:p-6">
      <Card.Header>
        <Card.Title>Owner &amp; Contacts</Card.Title>
        <Card.Description>
          Identitas, struktur, dan PIC pengelola asset. Konteks sumber impor
          tersedia terpisah sebagai referensi.
        </Card.Description>
      </Card.Header>
      <Card.Content className="grid min-w-0 gap-4">
        <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-muted text-sm">{label}</dt>
              <dd className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                {value || "Belum diisi"}
              </dd>
            </div>
          ))}
        </dl>
        {asset.ownerContact?.active === false && (
          <p className="text-danger text-sm">
            Owner contact is inactive. Existing reference is preserved.
          </p>
        )}
        <div className="grid min-w-0 gap-3">
          <h3 className="font-semibold">PIC pengelola tetap</h3>
          {asset.managementContacts?.length ? (
            <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
              {asset.managementContacts.map((contact, index) => (
                <li
                  key={index}
                  className="border-border grid min-w-0 gap-1 border-t pt-3 [overflow-wrap:anywhere]"
                >
                  <p className="text-muted text-sm">PIC {index + 1}</p>
                  <p className="font-medium">{contact.name}</p>
                  <p>{contact.email || "Email belum diisi"}</p>
                  <p>{contact.phone || "Telepon belum diisi"}</p>
                  {contact.active === false && (
                    <p className="text-danger text-sm">Kontak nonaktif</p>
                  )}
                </li>
              ))}
            </ul>
          ) : !asset.managementContacts?.length &&
            (asset.responsiblePic || details.picEmail) ? (
            <div className="grid min-w-0 gap-1 [overflow-wrap:anywhere]">
              <p className="text-muted text-sm">
                Kontak lama (referensi) — isi PIC terpisah melalui Edit asset.
              </p>
              <p className="whitespace-pre-wrap">{asset.responsiblePic}</p>
              <p>{details.picEmail || asset.importInfo?.picEmail}</p>
            </div>
          ) : (
            <p className="text-muted text-sm">Belum diisi</p>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

/** Old metadata remains readable without fabricating operational history. */
export function AssetLegacyContext({ asset }: { asset: Asset }) {
  const details = asset.details;
  if (
    !details ||
    !(details.eventName || details.setupName || details.confirmedDate)
  )
    return null;
  return (
    <div className="mb-6">
      <WorkflowDisclosure title="Konteks lama tersimpan (referensi)">
        <p className="text-muted text-sm">
          Nilai ini dipertahankan dari pencatatan sebelumnya. Ini bukan riwayat
          operasional terverifikasi dan tidak menetapkan umur atau terakhir
          digunakan. Penggunaan dan perpindahan mengikuti aktivitas asset.
        </p>
        <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
          {[
            ["Konteks event / koleksi lama", details.eventName],
            ["Setup / zona lama", details.setupName],
            [
              "Tanggal konteks lama",
              details.confirmedDate
                ? `${details.confirmedDate} · ${{ Event: "Event", Received: "Diterima", Used: "Penggunaan", Unconfirmed: "Arti belum dikonfirmasi" }[details.dateMeaning]}`
                : "",
            ],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-muted text-sm">{label}</dt>
                <dd className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                  {value}
                </dd>
              </div>
            ))}
        </dl>
      </WorkflowDisclosure>
    </div>
  );
}
