"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Chip, Input, TextArea } from "@heroui/react";

import { WorkflowDisclosure } from "@/components/shared/workflow-disclosure";
import { RecordedTime } from "@/components/shared/recorded-time";
import { ReturnStartForm } from "@/components/domain/return-start-form";
import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import {
  deriveReturnTasks,
  type JourneyStep,
} from "@/lib/domain/request-journey";
import { JourneyTimeline } from "@/components/domain/journey-timeline";
import { useLocalNow } from "@/components/shared/use-local-now";
import { findReturnReceipt } from "@/lib/domain/returns";
import type { AssetCondition, ReturnReceipt } from "@/types/prototype";

function displayTimestamp(value: string) {
  return <RecordedTime value={value} />;
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
  const {
    operationalLocations: registeredLocations,
    vendorLoading,
    vendorError,
  } = usePrototype();
  const [receivedBy, setReceivedBy] = useState("");
  const [locationId, setLocationId] = useState("");
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const canConfirm = Boolean(receivedBy.trim() && locationId && condition);

  return (
    <div className="grid gap-4">
      <p>Receiver confirmation · physical receipt only</p>
      <div className="grid gap-4 sm:grid-cols-2">
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
          isDisabled={vendorLoading}
          onChange={setLocationId}
          options={registeredLocations.map((location) => ({
            label: location.vendorId
              ? location.name
              : `${location.name} · ${location.city}`,
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
        <label className="grid gap-2 sm:col-span-2">
          Receipt notes (optional)
          <TextArea
            aria-label={`Receipt notes for ${assetId}`}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Condition or handover context"
            value={notes}
          />
        </label>
      </div>
      {vendorError ? (
        <p role="alert">{vendorError}</p>
      ) : vendorLoading ? (
        <p role="status">Loading vendor warehouses…</p>
      ) : null}
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
    <div className="grid gap-3">
      <p>Inspection pending · receipt does not make this Asset available.</p>
      <div className="flex flex-wrap gap-3">
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
    outboundDispatches,
    returnReceipts,
    startReturn,
    confirmReceived,
    completeInspection,
  } = usePrototype();
  const now = useLocalNow();
  const request = requests.find((item) => item.id === requestId);
  if (!request)
    return (
      <AppShell pageLabel="Return">
        <EmptyState
          actionHref="/requests"
          actionLabel="Back to requests"
          detail="This booking is not available in this session."
          title="Request not found"
        />
      </AppShell>
    );
  const tasks = deriveReturnTasks(
    request,
    outboundDispatches,
    returnReceipts,
    now,
  );
  const received = tasks.filter((task) =>
    ["Inspection pending", "On hold", "Completed"].includes(task.state),
  ).length;
  const completed = tasks.filter((task) => task.state === "Completed").length;
  const started = tasks.filter((task) =>
    [
      "Return in progress",
      "Inspection pending",
      "On hold",
      "Completed",
    ].includes(task.state),
  ).length;
  const steps: JourneyStep[] = [
    {
      label: "Scheduled",
      detail: `Return by ${request.returnDate ?? request.endDate}`,
      state: "complete",
    },
    {
      label: "Prepare return",
      detail: "Loading-out letter and handover",
      state:
        started === tasks.length && tasks.length > 0 ? "complete" : "current",
    },
    {
      label: "Return underway",
      detail: `${started}/${tasks.length} started`,
      state:
        received === tasks.length && tasks.length > 0
          ? "complete"
          : started
            ? "current"
            : "upcoming",
    },
    {
      label: "Received back",
      detail: `${received}/${tasks.length} received`,
      state:
        received === tasks.length && tasks.length > 0 ? "complete" : "upcoming",
    },
    {
      label: "Inspection",
      detail: `${completed}/${tasks.length} clear`,
      state:
        completed === tasks.length && tasks.length > 0
          ? "complete"
          : received
            ? "current"
            : "upcoming",
    },
  ];
  return (
    <AppShell pageLabel="Return tracking" showHeaderSearch={false}>
      <div className="mx-auto max-w-5xl space-y-6 pb-24">
        <header className="space-y-2">
          <Link className="text-accent text-xs" href={`/requests/${requestId}`}>
            ← Booking tracking
          </Link>
          <p className="text-muted text-xs">{request.id} · linked return</p>
          <h1 className="text-3xl font-bold tracking-tight">Return tracking</h1>
          <p className="text-muted text-sm">
            {request.projectName ?? request.purpose}
          </p>
          <Link className="text-accent text-xs" href="/operations">
            View operations calendar →
          </Link>
        </header>
        {tasks.length ? (
          <Card className="border-border gap-5 border p-4 sm:p-6">
            <Card.Header>
              <Card.Title>
                {tasks.length && completed === tasks.length
                  ? "Return completed"
                  : "Your return is already scheduled"}
              </Card.Title>
              <Card.Description>
                Prepare the loading-out letter, return the assets, then follow
                receipt and inspection here.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <JourneyTimeline steps={steps} />
            </Card.Content>
            <Card.Footer>
              <p className="text-muted text-xs">
                Expected inbound · {request.returnDate ?? request.endDate} ·{" "}
                {request.returnTime ?? "23:59"}
              </p>
            </Card.Footer>
          </Card>
        ) : null}
        <div className="grid gap-4">
          {tasks.map((task) => {
            const item = request.items.find(
              (item) => item.id === task.requestItemId,
            )!;
            const asset = assets.find((asset) => asset.id === task.assetId);
            const receipt = findReturnReceipt(returnReceipts, item.id);
            return (
              <Card
                className="return-item-card border-border gap-4 border p-4 sm:p-5"
                key={task.id}
              >
                <Card.Header className="flex-row flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-muted text-xs">
                      {asset?.code ?? item.assetId} · {item.quantity} item(s)
                    </p>
                    <h2 className="mt-1 line-clamp-2 text-lg font-semibold">
                      {asset?.name ?? item.assetId}
                    </h2>
                  </div>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={
                      task.state === "Completed"
                        ? "success"
                        : ["Overdue", "On hold"].includes(task.state)
                          ? "danger"
                          : "accent"
                    }
                  >
                    {task.state}
                    {task.overdue && task.state === "Return in progress"
                      ? " · overdue"
                      : ""}
                  </Chip>
                </Card.Header>
                <Card.Content className="grid gap-4">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted text-xs">Planned inbound</dt>
                      <dd>{task.dueAt.replace("T", " · ")}</dd>
                    </div>
                    <div>
                      <dt className="text-muted text-xs">Return destination</dt>
                      <dd>
                        {task.destination ??
                          "Receiver confirms the registered location"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted text-xs">Actual inbound</dt>
                      <dd>
                        {receipt?.receivedAt
                          ? displayTimestamp(receipt.receivedAt)
                          : "Not received · awaiting receiver confirmation"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted text-xs">
                        Current confirmed location
                      </dt>
                      <dd>
                        {asset?.location ?? "Unknown"} ·{" "}
                        {asset?.currentCustodian ?? "PIC not recorded"}
                      </dd>
                    </div>
                  </dl>
                  {task.historical ? (
                    <p className="text-muted text-xs">
                      Historical booking: outbound evidence is unavailable. Its
                      return must still be confirmed physically.
                    </p>
                  ) : null}
                  {task.state === "Awaiting delivery" ? (
                    <p className="text-muted text-sm">
                      The return task was created at dispatch. Confirm arrival
                      at the usage destination before preparing its return.
                    </p>
                  ) : null}
                  {receipt?.initiatedAt ? (
                    <p className="text-muted text-xs">
                      Return started · {displayTimestamp(receipt.initiatedAt)} ·{" "}
                      {receipt.initiatedBy}
                    </p>
                  ) : null}
                  {receipt?.receivedAt ? (
                    <p className="text-muted text-xs">
                      Received by {receipt.receivedBy} · Condition:{" "}
                      {receipt.conditionAtReceipt}
                    </p>
                  ) : null}
                  {receipt?.loadingOutLetters?.map((letter) => (
                    <a
                      key={letter.id}
                      className="text-accent text-sm"
                      href={letter.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {letter.name}
                    </a>
                  ))}
                  {receipt?.inspectedAt ? (
                    <p className="text-sm">
                      Inspection completed · {receipt.inspectionOutcome} ·{" "}
                      {displayTimestamp(receipt.inspectedAt)}
                    </p>
                  ) : null}
                </Card.Content>
                {task.canStart && !receipt?.inspectedAt ? (
                  <WorkflowDisclosure
                    className="border-border border-t pt-3"
                    title={
                      !receipt
                        ? "Prepare return"
                        : !receipt.receivedAt
                          ? "Confirm arrival at warehouse / workshop"
                          : "Inspect returned asset"
                    }
                  >
                    {!receipt ? (
                      <ReturnStartForm
                        onStart={(letters) =>
                          startReturn(request.id, item.id, letters)
                        }
                      />
                    ) : !receipt.receivedAt ? (
                      <ReceiptForm
                        assetId={item.assetId}
                        requestItemId={item.id}
                        requestId={request.id}
                        onConfirm={confirmReceived}
                      />
                    ) : (
                      <InspectionActions
                        assetId={item.assetId}
                        requestItemId={item.id}
                        requestId={request.id}
                        receipt={receipt}
                        onInspect={completeInspection}
                      />
                    )}
                  </WorkflowDisclosure>
                ) : null}
                {receipt?.receivedAt ? (
                  <Card.Footer>
                    <Link
                      className="text-accent text-xs"
                      href={`/maintenance/new?assetId=${item.assetId}&requestId=${request.id}&requestItemId=${item.id}`}
                    >
                      Create maintenance for this returned Asset →
                    </Link>
                  </Card.Footer>
                ) : null}
              </Card>
            );
          })}
          {!tasks.length ? (
            <EmptyState
              title="No return to process yet"
              detail={
                request.items.length
                  ? "A linked return appears when the approved assets are dispatched. Track delivery from the booking."
                  : "A Custom Booth requirement alone has no physical asset to return."
              }
              actionHref={`/requests/${requestId}`}
              actionLabel="Track booking"
            />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
