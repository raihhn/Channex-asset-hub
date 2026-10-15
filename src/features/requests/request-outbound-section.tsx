"use client";

import { useState } from "react";
import { Button, Card, Checkbox, Chip, Input } from "@heroui/react";
import { Truck, MapPin, CheckCheck } from "lucide-react";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { MovementLetterField } from "@/components/domain/movement-letter-field";
import { HeroSelect } from "@/components/shared/hero-select";
import { outboundGroups } from "@/lib/domain/outbound";
import type {
  AssetCondition,
  OutboundDispatch,
  PrototypeRequest,
  RequestDocument,
} from "@/types/prototype";

function timestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ItemChoice({
  name,
  checked,
  onChange,
}: {
  name: string;
  checked: boolean;
  onChange: (selected: boolean) => void;
}) {
  return (
    <Checkbox isSelected={checked} onChange={onChange}>
      <Checkbox.Content className="border-border flex items-center gap-3 rounded-xl border p-3 text-sm">
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <span>{name}</span>
      </Checkbox.Content>
    </Checkbox>
  );
}

function DispatchForm({
  request,
  groupId,
  itemIds,
}: {
  request: PrototypeRequest;
  groupId: string;
  itemIds: string[];
}) {
  const { assets, dispatchRequestAssets } = usePrototype();
  const [selected, setSelected] = useState(itemIds);
  const [senderPic, setSenderPic] = useState("");
  const [letters, setLetters] = useState<RequestDocument[]>(
    () =>
      request.supportingDocuments?.filter(
        (file) => file.category === "Loading-in letter" && file.dataUrl,
      ) ?? [],
  );
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const chosen = selected.filter((id) => itemIds.includes(id));
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {itemIds.map((id) => {
          const item = request.items.find((item) => item.id === id)!;
          const asset = assets.find((asset) => asset.id === item.assetId);
          return (
            <ItemChoice
              key={id}
              name={`${asset?.name ?? item.assetId} · ${item.quantity} ×`}
              checked={chosen.includes(id)}
              onChange={(checked) =>
                setSelected((current) =>
                  checked
                    ? [...current, id]
                    : current.filter((item) => item !== id),
                )
              }
            />
          );
        })}
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Sending PIC
        <Input
          aria-label="Sending PIC"
          variant="secondary"
          className="w-full min-w-0"
          placeholder="Person physically handing over these assets"
          value={senderPic}
          onChange={(event) => setSenderPic(event.target.value)}
        />
      </label>
      <MovementLetterField
        category="Loading-in letter"
        value={letters}
        onChange={setLetters}
        onReadingChange={setReading}
      />
      <p className="text-muted text-xs">
        Confirm only assets that have actually departed. Other items remain
        awaiting dispatch. Their last confirmed location is retained until
        destination receipt.
      </p>
      {error ? (
        <p
          role="alert"
          className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
        >
          {error}
        </p>
      ) : null}
      <Button
        className="w-full sm:w-auto"
        isDisabled={
          !chosen.length || !senderPic.trim() || !letters.length || reading
        }
        onPress={() => {
          try {
            dispatchRequestAssets(request.id, {
              groupId,
              itemIds: chosen,
              senderPic,
              loadingInLetters: letters,
            });
            setError("");
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not confirm dispatch.",
            );
          }
        }}
      >
        <Truck className="size-4" aria-hidden="true" />
        Confirm dispatched
      </Button>
    </div>
  );
}

function ReceiptForm({ record }: { record: OutboundDispatch }) {
  const { assets, receiveRequestAssets } = usePrototype();
  const pending = record.items.filter((item) => !item.receivedAt);
  const [selected, setSelected] = useState(
    pending.map((item) => item.requestItemId),
  );
  const [receiverPic, setReceiverPic] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("Good");
  const [error, setError] = useState("");
  const chosen = selected.filter((id) =>
    pending.some((item) => item.requestItemId === id),
  );
  if (!pending.length) return null;
  return (
    <div className="border-border grid gap-4 border-t pt-4">
      <h3 className="text-sm font-semibold">
        Confirm receipt at usage destination
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {pending.map((item) => (
          <ItemChoice
            key={item.requestItemId}
            name={
              assets.find((asset) => asset.id === item.assetId)?.name ??
              item.assetId
            }
            checked={chosen.includes(item.requestItemId)}
            onChange={(checked) =>
              setSelected((current) =>
                checked
                  ? [...current, item.requestItemId]
                  : current.filter((id) => id !== item.requestItemId),
              )
            }
          />
        ))}
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Receiving PIC at destination
          <Input
            aria-label="Receiving PIC at destination"
            variant="secondary"
            className="w-full min-w-0"
            placeholder="Person accepting the physical assets"
            value={receiverPic}
            onChange={(event) => setReceiverPic(event.target.value)}
          />
        </label>
        <HeroSelect
          label="Condition on arrival"
          variant="secondary"
          value={condition}
          onChange={(value) => setCondition(value as AssetCondition)}
          options={["Good", "Fair", "Needs review"].map((value) => ({
            label: value,
            value,
          }))}
        />
      </div>
      <p className="text-muted text-xs">
        Select only received assets. Confirm separately when items have
        different conditions or receiving PICs.
      </p>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      <Button
        className="w-full sm:w-auto"
        isDisabled={!chosen.length || !receiverPic.trim()}
        onPress={() => {
          try {
            receiveRequestAssets(record.requestId, record.id, {
              itemIds: chosen,
              receiverPic,
              condition,
            });
            setError("");
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not confirm receipt.",
            );
          }
        }}
      >
        <CheckCheck className="size-4" aria-hidden="true" />
        Confirm received at destination
      </Button>
    </div>
  );
}

export function RequestOutboundSection({
  request,
}: {
  request: PrototypeRequest;
}) {
  const { outboundDispatches, returnReceipts, assets } = usePrototype();
  const records = outboundDispatches.filter(
    (record) => record.requestId === request.id,
  );
  if (!request.items.length) return null;
  const canDispatch =
    ["Approved", "Ready"].includes(request.status) ||
    (request.status === "In use" && records.length > 0);
  const sentIds = records.flatMap((record) =>
    record.items.map((item) => item.requestItemId),
  );
  return (
    <Card
      className="request-outbound-panel border-border gap-5 border p-4 sm:p-6"
      aria-label="Request outbound"
    >
      <Card.Header className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted text-xs font-medium">
            Physical handover
          </span>
          <Chip variant="soft" color="accent">
            {sentIds.length}/{request.items.length} dispatched
          </Chip>
        </div>
        <Card.Title>Outbound to usage destination</Card.Title>
        <Card.Description>
          Loading-in letter → confirmed dispatch → confirmed receipt. Approval
          and planned dates do not prove physical delivery.
        </Card.Description>
      </Card.Header>
      {!canDispatch && !records.length ? (
        <p className="bg-surface-secondary text-muted rounded-xl p-4 text-sm">
          {["Pending approval", "Draft", "Needs update"].includes(
            request.status,
          )
            ? "Outbound opens after this request is approved."
            : "No outbound evidence is recorded for this historical request. Its existing return history is preserved."}
        </p>
      ) : null}
      {canDispatch
        ? outboundGroups(request).map((group) => {
            const remaining = group.itemIds.filter(
              (id) =>
                request.items.some((item) => item.id === id) &&
                !sentIds.includes(id) &&
                !returnReceipts.some((receipt) => receipt.requestItemId === id),
            );
            return remaining.length ? (
              <div
                key={group.id}
                className="border-border grid gap-4 rounded-2xl border p-4"
              >
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-muted text-xs">Approved destination</p>
                    <strong className="break-words">{group.destination}</strong>
                  </div>
                </div>
                <DispatchForm
                  request={request}
                  groupId={group.id}
                  itemIds={remaining}
                />
              </div>
            ) : null;
          })
        : null}
      {records.map((record) => (
        <div
          key={record.id}
          className="border-border grid gap-4 rounded-2xl border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{record.destination}</h3>
            <Chip
              size="sm"
              variant="soft"
              color={
                record.items.every((item) => item.receivedAt)
                  ? "success"
                  : "warning"
              }
            >
              {record.items.filter((item) => item.receivedAt).length}/
              {record.items.length} received
            </Chip>
          </div>
          <p className="text-muted text-xs">
            Dispatched {timestamp(record.dispatchedAt)} · sending PIC{" "}
            {record.senderPic}
          </p>
          <div className="flex flex-wrap gap-2">
            {record.loadingInLetters.map((file) => (
              <a
                key={file.id}
                className="text-accent text-xs break-words"
                href={file.dataUrl}
                target="_blank"
                rel="noreferrer"
              >
                {file.name}
              </a>
            ))}
          </div>
          <ul className="grid gap-2 text-xs">
            {record.items.map((item) => (
              <li
                className="bg-surface-secondary grid gap-1 rounded-xl p-3"
                key={item.requestItemId}
              >
                <strong>
                  {assets.find((asset) => asset.id === item.assetId)?.name ??
                    item.assetId}{" "}
                  · {item.quantity} ×
                </strong>
                <span className="text-muted">
                  {item.sourceLocation} → {record.destination}
                </span>
                <span>
                  {item.receivedAt
                    ? `Received ${timestamp(item.receivedAt)} · ${item.receiverPic} · ${item.conditionAtReceipt}`
                    : "In transit · destination receipt pending"}
                </span>
              </li>
            ))}
          </ul>
          <ReceiptForm record={record} />
        </div>
      ))}
    </Card>
  );
}
