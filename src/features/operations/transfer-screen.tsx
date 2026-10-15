"use client";

import { useMemo, useState } from "react";

import { JourneyTimeline } from "@/components/domain/journey-timeline";
import type { TransferPlan } from "@/types/identity";
import { AppShell } from "@/components/shared/app-shell";
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  TextArea,
  Disclosure,
} from "@heroui/react";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import {
  getRegisteredLocation,
  registeredLocations,
} from "@/lib/fixtures/registered-locations";
import type { AssetCondition } from "@/types/prototype";

const requiredEvidence = ["Front", "Left side", "Detail"] as const;

export function TransferScreen() {
  const {
    catalogAssets: assets,
    planTransfer,
    transferPlans,
    operationalLocations: registeredLocations,
    vendorLoading,
    vendorError,
  } = usePrototype();
  const [saving, setSaving] = useState(false);
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [destinationId, setDestinationId] = useState("");
  // Audit actor and physical handover/receiving PIC are different dimensions.
  const [responsibleParty, setResponsibleParty] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("Good");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [purpose, setPurpose] = useState("Workshop preparation");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [createOpen, setCreateOpen] = useState(!transferPlans.length);
  const [error, setError] = useState("");
  const asset = assets.find((candidate) => candidate.id === assetId);
  const destination = registeredLocations.find(
    (location) => location.id === destinationId,
  );
  const canSubmit = Boolean(
    asset &&
    destination &&
    destination.name !== asset.location &&
    responsibleParty.trim() &&
    evidence.length === requiredEvidence.length,
  );
  const evidenceLabel = useMemo(
    () => `${evidence.length}/${requiredEvidence.length} required views`,
    [evidence.length],
  );
  const toggleEvidence = (view: string) =>
    setEvidence((current) =>
      current.includes(view)
        ? current.filter((item) => item !== view)
        : [...current, view],
    );

  return (
    <AppShell pageLabel="Transfers" showHeaderSearch={false}>
      <div className="mx-auto max-w-5xl space-y-6 pb-24">
        <header className="space-y-2">
          <p className="text-muted text-xs">Asset movements</p>
          <h1 className="text-3xl font-bold tracking-tight">Transfers</h1>
          <p className="text-muted text-sm">
            Track warehouse and workshop movements separately from event
            bookings.
          </p>
        </header>
        <section className="grid gap-4" aria-label="Transfer tracking">
          {transferPlans.map((plan) => (
            <TransferTracking key={plan.id} plan={plan} />
          ))}
          {!transferPlans.length ? (
            <Card className="gap-2 p-5">
              <Card.Header>
                <Card.Title>No transfers yet</Card.Title>
                <Card.Description>
                  Create a movement plan, confirm dispatch, then confirm arrival
                  at the receiving warehouse or workshop.
                </Card.Description>
              </Card.Header>
            </Card>
          ) : null}
        </section>
        <Disclosure
          className="border-border bg-surface rounded-2xl border p-4"
          isExpanded={createOpen}
          onExpandedChange={(open) => {
            setCreateOpen(open);
            if (open) setSubmitted(false);
          }}
        >
          <Disclosure.Heading>
            <Button
              slot="trigger"
              variant="secondary"
              className="w-full justify-between"
            >
              <span>New transfer</span>
              <Disclosure.Indicator />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <Card.Header>
                    <Card.Title>Movement details</Card.Title>
                  </Card.Header>
                  <Card.Content className="grid gap-4">
                    <HeroSelect
                      label="Asset"
                      isDisabled={vendorLoading}
                      onChange={setAssetId}
                      value={assetId}
                      placeholder="Select asset"
                      options={assets.map((item) => ({
                        value: item.id,
                        label: `${item.name} · ${item.location}`,
                      }))}
                    />
                    <HeroSelect
                      label="Destination"
                      isDisabled={vendorLoading}
                      onChange={(id) => {
                        setDestinationId(id);
                        setResponsibleParty(
                          registeredLocations.find(
                            (location) => location.id === id,
                          )?.contact ?? "",
                        );
                      }}
                      value={destinationId}
                      placeholder="Search governed destinations"
                      options={registeredLocations
                        .filter(
                          (location) =>
                            location.type !== "Store" &&
                            location.name !== asset?.location,
                        )
                        .map((location) => ({
                          value: location.id,
                          label: location.vendorId
                            ? location.name
                            : `${location.name}, ${location.city}`,
                        }))}
                    />
                    {vendorLoading ? (
                      <p role="status" className="text-muted text-xs">
                        Loading vendor warehouses…
                      </p>
                    ) : vendorError ? (
                      <p
                        role="alert"
                        className="text-danger-soft-foreground text-xs"
                      >
                        {vendorError}
                      </p>
                    ) : null}
                    {destination?.vendorId ? (
                      <p className="text-muted text-sm">
                        {destination.address}
                      </p>
                    ) : null}
                    <label className="grid gap-2 text-sm">
                      <span>Responsible party</span>
                      <Input
                        aria-label="Responsible party"
                        onChange={(event) =>
                          setResponsibleParty(event.target.value)
                        }
                        placeholder="Actual receiving person"
                        value={responsibleParty}
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span>Purpose</span>
                      <Input
                        aria-label="Transfer purpose"
                        value={purpose}
                        onChange={(event) => setPurpose(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span>Notes</span>
                      <TextArea
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Optional handover notes"
                        value={notes}
                      />
                    </label>
                  </Card.Content>
                </Card>
                <Card>
                  <Card.Header>
                    <Card.Title>Condition evidence</Card.Title>
                    <Chip
                      color={canSubmit ? "success" : "warning"}
                      variant="soft"
                    >
                      {evidenceLabel}
                    </Chip>
                  </Card.Header>
                  <Card.Content className="grid gap-4">
                    <HeroSelect
                      label="Condition"
                      onChange={(value) =>
                        setCondition(value as AssetCondition)
                      }
                      value={condition}
                      options={["Good", "Fair", "Needs review"].map(
                        (value) => ({
                          value,
                          label: value,
                        }),
                      )}
                    />
                    <div className="grid gap-3">
                      <p>Photo-view checklist (prototype)</p>
                      {requiredEvidence.map((view) => (
                        <Checkbox
                          key={view}
                          isSelected={evidence.includes(view)}
                          onChange={() => toggleEvidence(view)}
                        >
                          <Checkbox.Content className="transfer-evidence__item flex items-center gap-3">
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            <span className="grid gap-1">
                              <strong>{view}</strong>
                              <small>
                                {view === "Detail"
                                  ? "Close-up of the important component"
                                  : `Full ${view.toLowerCase()} view`}
                              </small>
                            </span>
                          </Checkbox.Content>
                        </Checkbox>
                      ))}
                    </div>
                    <div className="bg-surface-secondary grid gap-2 rounded-lg p-4">
                      <strong>{asset?.name ?? "Select an asset"}</strong>
                      <span>
                        {asset?.location ?? "Current location"} →{" "}
                        {destination
                          ? `${destination.name}, ${destination.city}`
                          : "Select destination"}
                      </span>
                      <small>
                        Receiving owner ·{" "}
                        {responsibleParty ||
                          "Choose the actual receiving person"}
                      </small>
                    </div>
                    {error ? <p role="alert">{error}</p> : null}
                    <Button
                      isDisabled={
                        !canSubmit ||
                        submitted ||
                        saving ||
                        Boolean(destination?.vendorId && vendorLoading)
                      }
                      isPending={saving}
                      onPress={async () => {
                        setSaving(true);
                        try {
                          await planTransfer({
                            assetId,
                            destinationId,
                            responsibleParty,
                            condition,
                            evidence,
                            notes,
                            purpose,
                          });
                          setSubmitted(true);
                          setCreateOpen(false);
                          setError("");
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Could not submit transfer plan.",
                          );
                        } finally {
                          setSaving(false);
                        }
                      }}
                      type="button"
                    >
                      {submitted
                        ? "Submitted for confirmation"
                        : "Submit for confirmation"}
                    </Button>
                  </Card.Content>
                </Card>
              </div>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      </div>
    </AppShell>
  );
}

function TransferTracking({ plan }: { plan: TransferPlan }) {
  const { assets, dispatchTransferPlan, receiveTransferPlan } = usePrototype();
  const [confirming, setConfirming] = useState(false);
  const [sender, setSender] = useState("");
  const [receiver, setReceiver] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("Good");
  const [error, setError] = useState("");
  const asset = assets.find((asset) => asset.id === plan.assetId);
  const destination =
    plan.destinationSnapshot ?? getRegisteredLocation(plan.destinationId);
  const status = plan.receivedAt
    ? "Received"
    : plan.dispatchedAt
      ? "In transit"
      : "Awaiting dispatch";
  return (
    <Card
      className="border-border gap-4 border p-4 sm:p-5"
      aria-label={`Transfer ${plan.id}`}
    >
      <Card.Header className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted text-xs">{plan.id}</p>
          <Card.Title className="line-clamp-2">
            {asset?.name ?? plan.assetId}
          </Card.Title>
          <Card.Description>
            {plan.sourceLocation ?? "Recorded source unavailable"} →{" "}
            {destination?.name}
          </Card.Description>
        </div>
        <Chip
          size="sm"
          variant="soft"
          color={plan.receivedAt ? "success" : "accent"}
        >
          {status}
        </Chip>
      </Card.Header>
      <Card.Content className="grid gap-4">
        <JourneyTimeline
          steps={[
            {
              label: "Planned",
              detail: plan.purpose ?? "Movement plan",
              state: "complete",
            },
            {
              label: "Dispatch",
              detail: plan.dispatchedAt
                ? `${new Date(plan.dispatchedAt).toLocaleString("en-GB")} · ${plan.senderPic}`
                : "Sending PIC confirmation",
              state: plan.dispatchedAt ? "complete" : "current",
            },
            {
              label: "In transit",
              detail: plan.receivedAt
                ? "Arrived at destination"
                : "Waiting for destination receipt",
              state: plan.receivedAt
                ? "complete"
                : plan.dispatchedAt
                  ? "current"
                  : "upcoming",
            },
            {
              label: "Received",
              detail: plan.receivedAt
                ? `${new Date(plan.receivedAt).toLocaleString("en-GB")} · ${plan.receiverPic} · ${plan.conditionAtReceipt}`
                : "Receiving PIC confirmation",
              state: plan.receivedAt ? "complete" : "upcoming",
            },
          ]}
        />
        <p className="text-muted text-xs">
          Planned receiving PIC · {plan.responsibleParty}
        </p>
      </Card.Content>
      {!plan.receivedAt ? (
        <Disclosure className="border-border border-t pt-3">
          <Disclosure.Heading>
            <Button slot="trigger" variant="secondary">
              <span>
                {plan.dispatchedAt
                  ? "Confirm transfer arrival"
                  : "Confirm transfer dispatch"}
              </span>
              <Disclosure.Indicator />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="grid gap-3 pt-4">
              {!plan.dispatchedAt ? (
                <label className="grid gap-2 text-sm">
                  Sending PIC
                  <Input
                    aria-label="Transfer sending PIC"
                    value={sender}
                    onChange={(event) => setSender(event.target.value)}
                  />
                </label>
              ) : (
                <>
                  <label className="grid gap-2 text-sm">
                    Receiving PIC
                    <Input
                      aria-label="Transfer receiving PIC"
                      value={receiver}
                      onChange={(event) => setReceiver(event.target.value)}
                    />
                  </label>
                  <HeroSelect
                    label="Observed condition"
                    value={condition}
                    onChange={(value) => setCondition(value as AssetCondition)}
                    options={["Good", "Fair", "Needs review"].map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </>
              )}
              {error ? (
                <p role="alert" className="text-danger text-sm">
                  {error}
                </p>
              ) : null}
              <Button
                isDisabled={
                  confirming ||
                  (plan.dispatchedAt ? !receiver.trim() : !sender.trim())
                }
                isPending={confirming}
                onPress={async () => {
                  setConfirming(true);
                  try {
                    if (plan.dispatchedAt)
                      receiveTransferPlan(plan.id, receiver, condition);
                    else await dispatchTransferPlan(plan.id, sender);
                    setError("");
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not confirm transfer.",
                    );
                  } finally {
                    setConfirming(false);
                  }
                }}
              >
                {plan.dispatchedAt
                  ? "Confirm received transfer"
                  : "Confirm dispatched transfer"}
              </Button>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      ) : null}
    </Card>
  );
}
