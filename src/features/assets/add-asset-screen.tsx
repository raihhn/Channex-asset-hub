"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Button,
  Card,
  Chip,
  Input,
  Radio,
  RadioGroup,
  Switch,
} from "@heroui/react";
import { AppShell } from "@/components/shared/app-shell";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import {
  assetUnits,
  validateUnitPolicy,
  type AssetUnit,
  type UnitPolicy,
} from "@/lib/domain/asset-units";
import type {
  Asset,
  AssetClassification,
  AssetCondition,
} from "@/types/prototype";

export function AddAssetScreen() {
  const { registerAsset, currentUser, operationalLocations, vendorLoading } =
    usePrototype();
  const [step, setStep] = useState(1);
  const [tracking, setTracking] = useState("Individual");
  const [classification, setClassification] =
    useState<AssetClassification>("ASSET");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("All Brand");
  const [category, setCategory] =
    useState<Asset["category"]>("Supporting asset");
  const [condition, setCondition] = useState<AssetCondition>("Good");
  const [locationId, setLocationId] = useState("");
  const [unit, setUnit] = useState<AssetUnit>("Unit");
  const [quantity, setQuantity] = useState("1");
  const [openPackage, setOpenPackage] = useState(false);
  const [contents, setContents] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const locations = operationalLocations.filter(
    (location) => location.type === "Internal warehouse" || !!location.vendorId,
  );
  const selectedLocation = locations.find(
    (location) => location.id === locationId,
  );
  const policy: UnitPolicy =
    openPackage &&
    tracking === "Quantity-based" &&
    ["Dus", "Box", "Pack"].includes(unit)
      ? {
          stockUnit: "Pcs",
          packageUnit: unit,
          unitsPerPackage: Number(contents),
        }
      : { stockUnit: unit };
  const canRegister = currentUser.roles.some((role) =>
    ["SUPER_ADMIN", "STORE_DEV"].includes(role),
  );
  const next = () => {
    setError("");
    try {
      if (step === 1 && (!name.trim() || !selectedLocation))
        throw new Error("Enter the asset name and choose a warehouse.");
      if (step >= 2) {
        validateUnitPolicy(policy);
        const count = tracking === "Individual" ? 1 : Number(quantity);
        if (
          !Number.isFinite(count) ||
          count <= 0 ||
          (unit !== "Meter" && !Number.isSafeInteger(count))
        )
          throw new Error(
            "Enter a positive quantity (whole numbers except Meter).",
          );
      }
      if (step !== 4) {
        setStep(step + 1);
        return;
      }
      if (!selectedLocation) throw new Error("Choose a warehouse.");
      const count = tracking === "Individual" ? 1 : Number(quantity);
      const total = count * (policy.unitsPerPackage ?? 1);
      if (total > Number.MAX_SAFE_INTEGER)
        throw new Error("Stock quantity is too large.");
      const id = `asset-${crypto.randomUUID()}`;
      registerAsset({
        id,
        code: id,
        name: name.trim(),
        brand,
        category,
        classification,
        type: tracking,
        location: selectedLocation.name,
        locationType: selectedLocation.type,
        availability: "unavailable",
        condition,
        producedAt: "",
        ageLabel: "Not recorded",
        lastUsed: "Not recorded",
        lastUsedContext: "",
        description: "Documentation and physical verification pending.",
        artwork: "kit",
        tone: "teal",
        photos: [],
        issues: [],
        history: [],
        unitPolicy: policy,
        supportsQuantity: tracking === "Quantity-based",
        trackingType: tracking as Asset["trackingType"],
        totalQuantity: total,
        availableQuantity: total,
        inspectionState: "Inspection pending",
      });
      setCreated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to register asset.");
    }
  };
  return (
    <AppShell pageLabel="Add asset">
      <div className="add-asset-screen">
        <section className="screen-intro">
          <p>Asset Ops · prototype</p>
          <h1>Add new asset</h1>
          <span>
            Records remain in this session. Complete documentation and
            inspection before borrowing.
          </span>
        </section>
        {!canRegister ? (
          <p role="alert">
            Asset registration requires StoreDev or Super Admin access.
          </p>
        ) : created ? (
          <Card className="flow-step">
            <Chip color="success" variant="soft">
              Recorded
            </Chip>
            <h2>Asset registered</h2>
            <p>
              Stock:{" "}
              {tracking === "Individual"
                ? 1
                : Number(quantity) * (policy.unitsPerPackage ?? 1)}{" "}
              {policy.stockUnit}. Awaiting documentation and inspection.
            </p>
            <Link href="/assets">View inventory</Link>
          </Card>
        ) : (
          <Card className="request-flow-panel">
            <header>
              <p>Step {step} of 4</p>
              <h2>
                {
                  [
                    "Basic information",
                    "Quantity and units",
                    "Condition and documentation",
                    "Review",
                  ][step - 1]
                }
              </h2>
            </header>
            {step === 1 ? (
              <div className="hero-form-grid">
                <label>
                  Name
                  <Input
                    aria-label="Asset name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <HeroSelect
                  label="Classification"
                  onChange={(value) =>
                    setClassification(value as AssetClassification)
                  }
                  options={[
                    { label: "Asset", value: "ASSET" },
                    { label: "Reusable Inventory", value: "INVENTORY" },
                  ]}
                  value={classification}
                />
                <HeroSelect
                  label="Brand"
                  onChange={setBrand}
                  options={[
                    "All Brand",
                    "Wardah",
                    "Make Over",
                    "Emina",
                    "Kahf",
                    "Corporate",
                  ].map((value) => ({ label: value, value }))}
                  value={brand}
                />
                <HeroSelect
                  label="Category"
                  onChange={(value) => setCategory(value as Asset["category"])}
                  options={["Booth", "Supporting asset", "Display", "POSM"].map(
                    (value) => ({ label: value, value }),
                  )}
                  value={category}
                />
                <HeroSelect
                  label="Warehouse"
                  value={locationId}
                  onChange={setLocationId}
                  isDisabled={vendorLoading}
                  options={locations.map((location) => ({
                    label: location.name,
                    value: location.id,
                  }))}
                />
              </div>
            ) : null}
            {step === 2 ? (
              <div className="hero-form-grid">
                <RadioGroup
                  aria-label="Tracking type"
                  onChange={(value) => {
                    setTracking(value);
                    setOpenPackage(false);
                  }}
                  value={tracking}
                >
                  <Radio value="Individual">
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      One independently tracked asset
                    </Radio.Content>
                  </Radio>
                  <Radio value="Quantity-based">
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      Stock tracked by quantity
                    </Radio.Content>
                  </Radio>
                </RadioGroup>
                <HeroSelect
                  label="Unit of measure"
                  value={unit}
                  onChange={(value) => {
                    setUnit(value as AssetUnit);
                    setOpenPackage(false);
                  }}
                  options={assetUnits.map((value) => ({ label: value, value }))}
                />
                {tracking === "Quantity-based" ? (
                  <label>
                    Opening quantity ({unit})
                    <Input
                      aria-label="Opening quantity"
                      type="number"
                      min="0"
                      step={unit === "Meter" ? "any" : "1"}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </label>
                ) : (
                  <p>
                    One record represents 1 {unit}. Parts of a Set are not
                    borrowed independently.
                  </p>
                )}
                {tracking === "Quantity-based" &&
                ["Dus", "Box", "Pack"].includes(unit) ? (
                  <>
                    <Switch isSelected={openPackage} onChange={setOpenPackage}>
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        Packaging may be opened; allow borrowing in Pcs
                      </Switch.Content>
                    </Switch>
                    {openPackage ? (
                      <label>
                        Pcs per {unit}
                        <Input
                          aria-label="Pcs per package"
                          type="number"
                          min="1"
                          step="1"
                          value={contents}
                          onChange={(e) => setContents(e.target.value)}
                        />
                      </label>
                    ) : (
                      <p>
                        Borrowing uses {unit} only. No package conversion is
                        assumed.
                      </p>
                    )}
                  </>
                ) : null}
                {openPackage ? (
                  <p>
                    1 {unit} = {contents || "…"} Pcs. Stock and bookings use
                    Pcs. Packaging describes quantity; sealed packages are not
                    tracked separately.
                  </p>
                ) : null}
              </div>
            ) : null}
            {step === 3 ? (
              <div className="hero-form-grid">
                <HeroSelect
                  label="Initial condition"
                  onChange={(value) => setCondition(value as AssetCondition)}
                  options={["Good", "Fair", "Poor"].map((value) => ({
                    label: value,
                    value,
                  }))}
                  value={condition}
                />
                <p>
                  Required views: Front, Left, Right. Add documentation from
                  Asset Detail after registration. This record remains
                  unavailable until inspection is cleared.
                </p>
              </div>
            ) : null}
            {step === 4 ? (
              <div className="grid gap-3">
                <p>
                  {name} · {brand} · {selectedLocation?.name}
                </p>
                <p>
                  {tracking === "Individual" ? 1 : quantity} {unit}
                  {policy.packageUnit
                    ? ` = ${Number(quantity) * policy.unitsPerPackage!} Pcs`
                    : ""}
                </p>
                <p>
                  Borrowing:{" "}
                  {policy.packageUnit
                    ? `Pcs or ${unit}; 1 ${unit} = ${policy.unitsPerPackage} Pcs`
                    : unit}
                </p>
                <p>
                  Condition: {condition}. Documentation and inspection pending.
                </p>
              </div>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
            <footer className="request-flow-actions">
              <Button
                isDisabled={step === 1}
                onPress={() => {
                  setError("");
                  setStep(step - 1);
                }}
                variant="secondary"
              >
                Back
              </Button>
              <Button onPress={next} variant="primary">
                {step === 4 ? "Register asset" : "Continue"}
              </Button>
            </footer>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
