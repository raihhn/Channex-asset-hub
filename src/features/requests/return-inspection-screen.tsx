"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Chip, Input, TextArea } from "@heroui/react";

import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { registeredLocations } from "@/lib/fixtures/registered-locations";
import {
  getOperationalWindow,
  localDateTimeKey,
} from "@/lib/domain/reservations";
import { findReturnReceipt, getReturnProgress } from "@/lib/domain/returns";
import type { AssetCondition, ReturnReceipt } from "@/types/prototype";

function displayTimestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ReceiptForm({
  requestId,
  requestItemId,
  assetId,
  onConfirm,
}: {
  requestId: string;
  requestItemId: string;
  assetId: string;
  onConfirm: (
    requestId: string,
    requestItemId: string,
    input: {
      receivedBy: string;
      receivingLocationId: string;
      conditionAtReceipt: AssetCondition;
      notes?: string;
    },
  ) => void;
}) {
  const [receivedBy, setReceivedBy] = useState("");
  const [locationId, setLocationId] = useState("");
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const canConfirm = Boolean(receivedBy.trim() && locationId && condition);

  return (
    <div className="return-receipt-form">
      <p>Receiver confirmation · physical receipt only</p>
      <div className="return-receipt-form__fields">
        <label>
          Receiving PIC
          <Input
            aria-label={`Receiving PIC for ${assetId}`}
            onChange={(event) => setReceivedBy(event.target.value)}
            placeholder="Name of the person accepting the asset"
            value={receivedBy}
          />
        </label>
        <HeroSelect
          label="Actual receiving location"
          onChange={setLocationId}
          options={registeredLocations.map((location) => ({
            label: `${location.name} · ${location.city}`,
            value: location.id,
          }))}
          value={locationId}
        />
        <HeroSelect
          label="Condition at receipt"
          onChange={setCondition}
          options={(["Good", "Fair", "Needs review"] as const).map((value) => ({
            label: value,
            value,
          }))}
          value={condition}
        />
        <label className="return-receipt-form__notes">
          Receipt notes (optional)
          <TextArea
            aria-label={`Receipt notes for ${assetId}`}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Condition or handover context"
            value={notes}
          />
        </label>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <Button
        isDisabled={!canConfirm}
        onPress={() => {
          try {
            onConfirm(requestId, requestItemId, {
              receivedBy,
              receivingLocationId: locationId,
              conditionAtReceipt: condition as AssetCondition,
              notes,
            });
            setError("");
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not record receipt.",
            );
          }
        }}
        variant="primary"
      >
        Confirm Received
      </Button>
    </div>
  );
}

function InspectionActions({
  requestId,
  requestItemId,
  assetId,
  receipt,
  onInspect,
}: {
  requestId: string;
  requestItemId: string;
  assetId: string;
  receipt: ReturnReceipt;
  onInspect: (
    requestId: string,
    requestItemId: string,
    outcome: "Clear" | "On hold",
  ) => void;
}) {
  const [error, setError] = useState("");
  if (receipt.inspectedAt) {
    return (
      <p>
        Inspection completed · {receipt.inspectionOutcome} ·{" "}
        {displayTimestamp(receipt.inspectedAt)}
      </p>
    );
  }
  const decide = (outcome: "Clear" | "On hold") => {
    try {
      onInspect(requestId, requestItemId, outcome);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not record inspection.",
      );
    }
  };
  return (
    <div className="return-inspection-actions">
      <p>Inspection pending · receipt does not make this Asset available.</p>
      <div>
        <Button onPress={() => decide("Clear")} variant="primary">
          Mark inspection clear
        </Button>
        <Button onPress={() => decide("On hold")} variant="tertiary">
          Place on hold
        </Button>
        <Link href={`/assets/${assetId}/issue`}>Report issue</Link>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

export function ReturnInspectionScreen({ requestId }: { requestId: string }) {
  const {
    requests,
    assets,
    returnReceipts,
    startReturn,
    confirmReceived,
    completeInspection,
  } = usePrototype();
  const [error, setError] = useState("");
  const request = requests.find((item) => item.id === requestId);
  if (!request) {
    return (
      <AppShell pageLabel="Return">
        <EmptyState
          actionHref="/requests"
          actionLabel="Back to requests"
          detail="This request is not available in this prototype session."
          title="Request not found"
        />
      </AppShell>
    );
  }
  const plannedInboundAt = getOperationalWindow(request).inboundAt;
  const now = localDateTimeKey(new Date());

  return (
    <AppShell pageLabel="Return">
      <div className="return-screen">
        <section className="screen-intro">
          <p>Return / receipt</p>
          <h1>Return physical assets</h1>
          <span>
            {requestId} · each Asset is returned and received independently.
          </span>
          <Link href={`/requests/${requestId}`}>← Request detail</Link>
          <Link href="/operations">View operations calendar →</Link>
        </section>
        <p className="return-screen__guidance">
          Expected inbound · {plannedInboundAt.replace("T", " · ")}. Starting a
          return does not confirm physical receipt or change location. The
          receiver must confirm each item.
        </p>
        {request.items.length ? (
          <div className="return-screen__items">
            {request.items.map((item) => {
              const asset = assets.find(
                (candidate) => candidate.id === item.assetId,
              );
              const receipt = findReturnReceipt(returnReceipts, item.id);
              const progress = getReturnProgress(
                receipt,
                plannedInboundAt,
                now,
              );
              return (
                <Card className="return-item-card" key={item.id}>
                  <div className="return-item-card__header">
                    <div>
                      <p>{asset?.code ?? item.assetId}</p>
                      <h2>{asset?.name ?? item.assetId}</h2>
                      <small>
                        {item.quantity} × {asset?.category ?? "Asset"}
                      </small>
                    </div>
                    <Chip
                      color={
                        receipt?.receivedAt
                          ? "success"
                          : progress.includes("overdue") ||
                              progress === "Overdue"
                            ? "danger"
                            : "accent"
                      }
                      size="sm"
                      variant="soft"
                    >
                      {progress}
                    </Chip>
                  </div>
                  <dl className="return-item-card__facts">
                    <div>
                      <dt>Planned inbound</dt>
                      <dd>{plannedInboundAt.replace("T", " · ")}</dd>
                    </div>
                    <div>
                      <dt>Actual inbound</dt>
                      <dd>
                        {receipt?.receivedAt
                          ? displayTimestamp(receipt.receivedAt)
                          : "Not received"}
                      </dd>
                    </div>
                    <div>
                      <dt>Current location</dt>
                      <dd>{asset?.location ?? "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Current custodian</dt>
                      <dd>{asset?.currentCustodian ?? "Not recorded"}</dd>
                    </div>
                  </dl>
                  {!receipt ? (
                    <Button
                      onPress={() => {
                        try {
                          startReturn(request.id, item.id);
                          setError("");
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Could not start return.",
                          );
                        }
                      }}
                      variant="primary"
                    >
                      Start Return
                    </Button>
                  ) : !receipt.receivedAt ? (
                    <ReceiptForm
                      assetId={item.assetId}
                      requestItemId={item.id}
                      onConfirm={confirmReceived}
                      requestId={request.id}
                    />
                  ) : (
                    <div className="return-item-card__received">
                      <p>
                        Received by {receipt.receivedBy} · Condition:{" "}
                        {receipt.conditionAtReceipt}
                      </p>
                      {receipt.notes ? <small>{receipt.notes}</small> : null}
                      <InspectionActions
                        assetId={item.assetId}
                        requestItemId={item.id}
                        onInspect={completeInspection}
                        receipt={receipt}
                        requestId={request.id}
                      />
                      <Link href={`/maintenance/new?assetId=${item.assetId}&requestId=${request.id}&requestItemId=${item.id}`}>Create maintenance for this returned Asset →</Link>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="return-item-card">
            <h2>No physical Asset to return</h2>
            <p>
              A Custom Booth requirement alone has no physical return record.
            </p>
          </Card>
        )}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </AppShell>
  );
}
