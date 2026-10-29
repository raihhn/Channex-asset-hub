"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, TextArea } from "@heroui/react";
import { AppShell } from "@/components/shared/app-shell";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import {
  readLocalApi,
  localIdentityMessage,
  selectDevelopmentPerson,
  isLocalSessionError,
} from "@/lib/actor-client";
import {
  validateRegistrationIntent,
  type RegistrationIntent,
  type RegistrationMetadata,
} from "@/lib/domain/asset-registration";
import { assetUnits } from "@/lib/domain/asset-units";
import {
  AssetCommandError,
  type UploadDraftPhoto,
} from "@/lib/asset-registration-client";
import type { Asset, AssetCondition } from "@/types/prototype";
import { AssetContactPicker } from "./asset-contact-picker";
import { AssetPhotoFields } from "./asset-photo-fields";
import { RegistrationMetadataFields } from "./registration-metadata-fields";
type GroupChoice = {
  id: string;
  name: string;
  version: number;
  ownerName: string;
  picName: string;
  memberCount: number;
};
type WarehouseChoice = {
  id: string;
  name: string;
  type: string;
  vendorId?: string;
  address: string;
};
export function AddAssetScreen() {
  const { currentUser, registerAsset } = usePrototype();
  const router = useRouter();
  const allowed = currentUser.roles.some(
    (r) => r === "STORE_DEV" || r === "SUPER_ADMIN",
  );
  const [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState("");
  const [mastersLoading, setMastersLoading] = useState(true);
  const [groups, setGroups] = useState<GroupChoice[]>([]),
    [locations, setLocations] = useState<WarehouseChoice[]>([]);
  const [groupMode, setGroupMode] = useState("standalone"),
    [groupId, setGroupId] = useState(""),
    [groupName, setGroupName] = useState("");
  const [name, setName] = useState(""),
    [legacyReference, setLegacyReference] = useState(""),
    [brand, setBrand] = useState("All Brand"),
    [category, setCategory] = useState("Supporting asset"),
    [warehouseType, setWarehouseType] = useState("Internal warehouse"),
    [warehouseId, setWarehouseId] = useState("");
  const [owner, setOwner] = useState<string[]>([]),
    [pics, setPics] = useState<string[]>([]),
    [unit, setUnit] = useState("Unit"),
    [condition, setCondition] = useState<AssetCondition>("Good"),
    [conditionNotes, setConditionNotes] = useState(""),
    [description, setDescription] = useState("");
  const [metadata, setMetadata] = useState<RegistrationMetadata>({}),
    [photos, setPhotos] = useState<UploadDraftPhoto[]>([]);
  const submission = useRef<{
    intent: RegistrationIntent;
    photos: UploadDraftPhoto[];
  } | null>(null);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    Promise.all([
      readLocalApi<GroupChoice[]>("/api/asset-groups"),
      readLocalApi<WarehouseChoice[]>("/api/asset-registration-locations"),
    ])
      .then(([g, l]) => {
        if (active) {
          setGroups(g);
          setLocations(l);
          setLoadError("");
          setMastersLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setLoadError(e.message);
          setMastersLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [allowed, currentUser.id]);
  const chosenGroup = groups.find((g) => g.id === groupId),
    chosenLocation = locations.find((l) => l.id === warehouseId);
  const changeGroup = (mode: string) => {
    setGroupMode(mode);
    setPics([]);
    setOwner([]);
    setGroupId("");
  };
  function basicValidation() {
    if (
      !name.trim() ||
      !chosenLocation ||
      chosenLocation.type !== warehouseType
    )
      throw Error("Enter the asset name and select a registered warehouse.");
    if (groupMode === "existing") {
      if (!chosenGroup) throw Error("Select an existing group.");
    } else {
      if (!owner.length || !pics.length)
        throw Error(
          "Choose Owner and managing PIC from the internal contact master.",
        );
      if (groupMode === "create" && !groupName.trim())
        throw Error("Enter the new group name.");
    }
  }
  async function next() {
    setError("");
    try {
      basicValidation();
      if (
        step === 3 &&
        !photos.some((p) => p.isPrimary && p.category === "Asset")
      )
        throw Error("Choose at least one real primary Asset Photo.");
      if (step < 4) {
        setStep(step + 1);
        return;
      }
      if (!submission.current) {
        const asset = {
          name,
          legacyReference,
          brand,
          category: category as Asset["category"],
          classification: "ASSET",
          trackingType: "Individual",
          quantity: 1,
          unitPolicy: { stockUnit: unit },
          condition,
          conditionNotes,
          description,
          location: chosenLocation!.vendorId
            ? {
                kind: "vendor",
                vendorId: chosenLocation!.vendorId,
                warehouseId,
              }
            : { kind: "internal", warehouseId },
          group:
            groupMode === "existing"
              ? {
                  mode: "existing",
                  id: groupId,
                  expectedVersion: chosenGroup!.version,
                }
              : groupMode === "create"
                ? {
                    mode: "create",
                    name: groupName,
                    ownerContactId: owner[0],
                    managingContactId: pics[0],
                  }
                : { mode: "standalone" },
          ...(groupMode === "standalone"
            ? { ownerContactId: owner[0], managementContactIds: pics }
            : {}),
          metadata,
        };
        submission.current = {
          intent: validateRegistrationIntent({
            commandKey: crypto.randomUUID(),
            asset,
          }),
          photos: [...photos],
        };
      }
      setBusy(true);
      setFrozen(true);
      const saved = await registerAsset(
        submission.current.intent,
        submission.current.photos,
      );
      router.push(`/assets/${encodeURIComponent(saved.id)}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Registration failed.";
      setError(message);
      if (
        e instanceof AssetCommandError &&
        ([400, 413, 415].includes(e.status) || e.code === "DISABLED")
      ) {
        submission.current = null;
        setFrozen(false);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell pageLabel="Add asset">
      <div className="relative mx-auto grid w-full max-w-4xl min-w-0 gap-6 overflow-x-clip pb-6">
        <section className="screen-intro">
          <p>Asset Inventory</p>
          <h1>Add new asset</h1>
          <span>
            Save an individual asset with private documentation. New assets
            remain Unavailable / Inspection Pending.
          </span>
        </section>
        {!allowed ? (
          <Card className="p-6">
            <p role="alert">
              Asset registration requires StoreDev or Super Admin. Select a
              local identity in Me.
            </p>
            <Link href="/me">Open Me</Link>
          </Card>
        ) : (
          <Card className="min-w-0 p-4 sm:p-6">
            <Card.Header>
              <Card.Description>Step {step} of 4</Card.Description>
              <Card.Title>
                {
                  [
                    "Basic information",
                    "Quantity and units",
                    "Condition and documentation",
                    "Review",
                  ][step - 1]
                }
              </Card.Title>
            </Card.Header>
            <Card.Content className="grid min-w-0 gap-6">
              {loadError && (
                <p role="alert" className="text-danger">
                  {localIdentityMessage(loadError)}
                </p>
              )}
              <fieldset
                disabled={busy || frozen}
                className="grid min-w-0 gap-6"
              >
                {step === 1 && (
                  <>
                    <HeroSelect
                      label="Asset Group"
                      value={groupMode}
                      onChange={changeGroup}
                      options={[
                        {
                          value: "standalone",
                          label: "Standalone individual asset",
                        },
                        {
                          value: "create",
                          label: "Create group with this asset",
                        },
                        { value: "existing", label: "Join an existing group" },
                      ]}
                    />
                    {groupMode === "create" && (
                      <label className="grid min-w-0 gap-2">
                        New group name
                        <Input
                          className="w-full min-w-0"
                          maxLength={250}
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                        />
                      </label>
                    )}
                    {groupMode === "existing" && (
                      <>
                        <HeroSelect
                          label="Select existing group"
                          isDisabled={mastersLoading}
                          value={groupId}
                          onChange={setGroupId}
                          options={groups.map((g) => ({
                            value: g.id,
                            label: `${g.name} · ${g.memberCount} individuals`,
                          }))}
                        />
                        {chosenGroup && (
                          <p className="bg-surface-secondary rounded-xl p-4 text-sm">
                            Inherited from {chosenGroup.name}: Owner{" "}
                            {chosenGroup.ownerName} · PIC {chosenGroup.picName}.
                            Assignments cannot be changed here.
                          </p>
                        )}
                      </>
                    )}
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-2">
                        Asset name
                        <Input
                          className="w-full min-w-0"
                          aria-label="Asset name"
                          required
                          maxLength={250}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2">
                        Nomor asset lama / referensi (opsional)
                        <Input
                          className="w-full min-w-0"
                          maxLength={250}
                          value={legacyReference}
                          onChange={(e) => setLegacyReference(e.target.value)}
                        />
                      </label>
                      <HeroSelect
                        label="Brand"
                        value={brand}
                        onChange={setBrand}
                        options={[
                          "All Brand",
                          "Wardah",
                          "Make Over",
                          "Emina",
                          "Kahf",
                          "Corporate",
                        ].map((v) => ({ value: v, label: v }))}
                      />
                      <HeroSelect
                        label="Category"
                        value={category}
                        onChange={setCategory}
                        options={[
                          "Booth",
                          "Supporting asset",
                          "Display",
                          "POSM",
                        ].map((v) => ({ value: v, label: v }))}
                      />
                      <HeroSelect
                        label="Warehouse type"
                        value={warehouseType}
                        onChange={(v) => {
                          setWarehouseType(v);
                          setWarehouseId("");
                        }}
                        options={["Internal warehouse", "Vendor warehouse"].map(
                          (v) => ({ value: v, label: v }),
                        )}
                      />
                      <HeroSelect
                        label="Warehouse location"
                        isDisabled={mastersLoading}
                        value={warehouseId}
                        onChange={setWarehouseId}
                        options={locations
                          .filter((l) => l.type === warehouseType)
                          .map((l) => ({ value: l.id, label: l.name }))}
                      />
                    </div>
                    {chosenLocation && (
                      <p className="text-muted text-sm">
                        {chosenLocation.address || "Address not recorded"}
                      </p>
                    )}
                    {groupMode !== "existing" && (
                      <>
                        <AssetContactPicker
                          label="Owner asset"
                          single
                          value={owner}
                          onChange={(ids) => setOwner(ids)}
                        />
                        <AssetContactPicker
                          single={groupMode === "create"}
                          value={pics}
                          onChange={(ids) => setPics(ids)}
                        />
                      </>
                    )}
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-muted text-sm">Classification</p>
                        <p>ASSET</p>
                      </div>
                      <div>
                        <p className="text-muted text-sm">
                          Tracking / quantity
                        </p>
                        <p>Individual · 1</p>
                      </div>
                      <HeroSelect
                        label="Unit of measurement"
                        value={unit}
                        onChange={setUnit}
                        options={assetUnits.map((v) => ({
                          value: v,
                          label: v,
                        }))}
                      />
                    </div>
                    <p className="text-muted text-sm">
                      One Set is one tracked individual. Group total counts
                      individuals; package contents are not inferred.
                    </p>
                  </>
                )}
                {step === 3 && (
                  <>
                    <HeroSelect
                      label="Recorded condition"
                      value={condition}
                      onChange={(v) => setCondition(v as AssetCondition)}
                      options={["Good", "Fair", "Needs review"].map((v) => ({
                        value: v,
                        label: v,
                      }))}
                    />
                    <label className="grid min-w-0 gap-2">
                      Condition description (optional)
                      <TextArea
                        className="w-full min-w-0"
                        maxLength={2000}
                        value={conditionNotes}
                        onChange={(e) => setConditionNotes(e.target.value)}
                      />
                    </label>
                    <AssetPhotoFields value={photos} onChange={setPhotos} />
                    <label className="grid min-w-0 gap-2">
                      Asset description
                      <TextArea
                        className="w-full min-w-0"
                        maxLength={2000}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </label>
                    <RegistrationMetadataFields
                      value={metadata}
                      onChange={setMetadata}
                    />
                  </>
                )}
                {step === 4 && (
                  <>
                    <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                      {[
                        ["Asset", name],
                        ["Nomor asset", "Nomor AST dibuat otomatis saat disimpan"],
                        ["Nomor asset lama / referensi", legacyReference || "Belum diisi"],
                        ["Brand / category", `${brand} · ${category}`],
                        [
                          "Group",
                          groupMode === "standalone"
                            ? "Standalone"
                            : groupMode === "create"
                              ? groupName
                              : chosenGroup?.name,
                        ],
                        ["Warehouse", chosenLocation?.name],
                        ["Tracking", `Individual · 1 ${unit}`],
                        ["Condition", condition],
                        [
                          "Documentation",
                          `${photos.length} actual images · primary ${photos.find((p) => p.isPrimary)?.file.name ?? "missing"}`,
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-muted text-sm">{label}</dt>
                          <dd className="[overflow-wrap:anywhere]">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="bg-surface-secondary rounded-xl p-4 text-sm">
                      Unavailable / Inspection Pending after registration.
                      Registration and photographs do not establish physical
                      inspection or booking readiness.
                    </p>
                  </>
                )}
              </fieldset>
              {error && (
                <div className="grid gap-3">
                  <p role="alert" className="text-danger">
                    {isLocalSessionError(error)
                      ? localIdentityMessage(error)
                      : error}
                  </p>
                  {isLocalSessionError(error) && currentUser.id && (
                    <Button
                      variant="secondary"
                      onPress={async () => {
                        try {
                          await selectDevelopmentPerson(currentUser.id);
                          setError(
                            "Session restored. Retry the same submission.",
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Restore selected local identity
                    </Button>
                  )}
                  {frozen && (
                    <p className="text-muted text-sm">
                      Submission outcome is not confirmed. Your original draft
                      and command key are locked; retry the same submission to
                      avoid a duplicate.
                    </p>
                  )}
                </div>
              )}
              <div className="border-border flex flex-wrap justify-between gap-3 border-t pt-4">
                <Button
                  variant="tertiary"
                  isDisabled={busy || frozen || step === 1}
                  onPress={() => setStep(step - 1)}
                >
                  Back
                </Button>
                <Button
                  isPending={busy}
                  isDisabled={busy || !!loadError || mastersLoading}
                  onPress={() => void next()}
                >
                  {step === 4
                    ? frozen
                      ? "Retry same registration"
                      : "Register asset"
                    : "Continue"}
                </Button>
              </div>
            </Card.Content>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
