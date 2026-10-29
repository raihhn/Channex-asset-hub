import type {
  OutboundDispatch,
  PrototypeRequest,
  ReturnReceipt,
} from "@/types/prototype";
import { getOperationalWindow } from "@/lib/domain/reservations";

export type JourneyStep = {
  label: string;
  detail: string;
  state: "complete" | "current" | "upcoming";
};
export type ReturnTask = {
  id: string;
  requestId: string;
  requestItemId: string;
  assetId: string;
  dueAt: string;
  destination?: string;
  historical: boolean;
  canStart: boolean;
  overdue: boolean;
  state:
    | "Awaiting delivery"
    | "Scheduled"
    | "Due today"
    | "Overdue"
    | "Return in progress"
    | "Inspection pending"
    | "On hold"
    | "Completed";
};

/** Tasks are derived from physical handovers, never a second booking or a receipt invented by a date. */
export function deriveReturnTasks(
  request: PrototypeRequest,
  dispatches: OutboundDispatch[],
  receipts: ReturnReceipt[],
  now: string,
): ReturnTask[] {
  if (
    [
      "Draft",
      "Pending approval",
      "Needs update",
      "Rejected",
      "Cancelled",
    ].includes(request.status)
  )
    return [];
  const packets = dispatches.filter(
    (record) => record.requestId === request.id,
  );
  const historical =
    packets.length === 0 &&
    [
      "In use",
      "Return due",
      "Overdue",
      "Inspection pending",
      "Completed",
    ].includes(request.status);
  return request.items.flatMap((item) => {
    const packet = packets.find((record) =>
      record.items.some((entry) => entry.requestItemId === item.id),
    );
    const sent = packet?.items.find((entry) => entry.requestItemId === item.id);
    const receipt = receipts.find(
      (record) =>
        record.requestId === request.id && record.requestItemId === item.id,
    );
    if (!sent && !receipt && !historical) return [];
    const group = request.fulfillmentGroups?.find((group) =>
      group.itemIds.includes(item.id),
    );
    const dueAt = group?.returnDate
      ? `${group.returnDate}T${group.returnTime ?? "23:59"}`
      : getOperationalWindow(request).inboundAt;
    const canStart = Boolean(sent?.receivedAt || receipt || historical);
    const state: ReturnTask["state"] = receipt?.receivedAt
      ? receipt.inspectedAt && receipt.inspectionOutcome === "Clear"
        ? "Completed"
        : receipt.inspectionOutcome === "On hold"
          ? "On hold"
          : "Inspection pending"
      : receipt
        ? "Return in progress"
        : !canStart
          ? "Awaiting delivery"
          : now > dueAt
            ? "Overdue"
            : now.slice(0, 10) === dueAt.slice(0, 10)
              ? "Due today"
              : "Scheduled";
    return [
      {
        id: `return-task:${item.id}`,
        requestId: request.id,
        requestItemId: item.id,
        assetId: item.assetId,
        dueAt,
        destination:
          request.returnGroups?.find((group) => group.itemIds.includes(item.id))
            ?.to ?? sent?.sourceLocation,
        historical: !sent && !receipt,
        canStart,
        overdue: canStart && !receipt?.receivedAt && now > dueAt,
        state,
      },
    ];
  });
}

export function requestJourney(
  request: PrototypeRequest,
  dispatches: OutboundDispatch[],
  receipts: ReturnReceipt[],
  now: string,
) {
  const tasks = deriveReturnTasks(request, dispatches, receipts, now);
  const sent = dispatches
    .filter((record) => record.requestId === request.id)
    .flatMap((record) => record.items);
  const received = sent.filter((item) => item.receivedAt).length;
  const returned = tasks.filter((task) =>
    ["Inspection pending", "On hold", "Completed"].includes(task.state),
  ).length;
  const complete =
    request.items.length > 0 &&
    tasks.length === request.items.length &&
    tasks.every((task) => task.state === "Completed");
  const returnStarted = tasks.some((task) =>
    [
      "Return in progress",
      "Inspection pending",
      "On hold",
      "Completed",
    ].includes(task.state),
  );
  const attention = tasks.filter(
    (task) => task.overdue || ["Due today", "On hold"].includes(task.state),
  );
  const review = [
    "Draft",
    "Pending approval",
    "Needs update",
    "Rejected",
    "Cancelled",
  ].includes(request.status);
  const needsDelivery =
    !review &&
    request.items.length > 0 &&
    (sent.length > 0
      ? sent.length < request.items.length || received < request.items.length
      : ["Approved", "Ready"].includes(request.status));
  const closed =
    ["Rejected", "Cancelled"].includes(request.status) ||
    complete ||
    (!request.items.length && request.status === "Completed");
  let stage = review
    ? 1
    : needsDelivery
      ? 2
      : complete
        ? 5
        : returned === request.items.length && returned > 0
          ? 4
          : returnStarted || attention.length
            ? 3
            : 2;
  if (!request.items.length && !review) stage = closed ? 5 : 2;
  const label = review
    ? request.status === "Pending approval"
      ? "Awaiting approval"
      : request.status
    : complete
      ? "Request completed"
      : tasks.some((task) => task.state === "On hold")
        ? "Inspection on hold"
        : needsDelivery
          ? sent.length
            ? "Delivery in progress"
            : "Preparing delivery"
          : returned === request.items.length && returned > 0
            ? "Return inspection"
            : tasks.some((task) => task.overdue)
              ? "Return overdue"
              : tasks.some((task) => task.state === "Due today")
                ? "Return due today"
                : returnStarted
                  ? "Return in progress"
                  : request.items.length
                    ? "Assets in use"
                    : "Approved requirement";
  const description = review
    ? request.status === "Needs update"
      ? "Read the feedback, revise this request, then resubmit."
      : request.status === "Pending approval"
        ? "Your request is submitted. Track the approval here before assets are prepared."
        : "Your request and its decision remain available here."
    : complete
      ? "Every physical asset has been received back and cleared after inspection."
      : needsDelivery
        ? `${sent.length}/${request.items.length} items dispatched · ${received}/${request.items.length} received at destination.`
        : tasks.some((task) => task.state === "On hold")
          ? "A returned asset needs follow-up before it can be reused."
          : returned === request.items.length && returned > 0
            ? "Assets are back. The receiving team is checking their condition."
            : attention.length
              ? "Prepare the loading-out letter and return the outstanding assets from this booking."
              : returnStarted
                ? `${returned}/${request.items.length} items received back. Track the remaining returns here.`
                : request.items.length
                  ? "The return is already linked to this booking. You can prepare it before the return deadline."
                  : "This requirement has no physical asset shipment or return.";
  const steps: JourneyStep[] = [
    { label: "Submitted", detail: request.submittedAt, state: "complete" },
    {
      label: "Approval",
      detail: review ? label : "Approved",
      state: stage > 1 ? "complete" : "current",
    },
    {
      label: "Delivery / use",
      detail: sent.length
        ? `${received}/${request.items.length} received`
        : !sent.length && tasks.length > 0
          ? "Historical booking; outbound receipt unavailable"
          : !request.items.length
            ? "No physical shipment"
            : "Awaiting dispatch",
      state:
        received === request.items.length && received > 0
          ? "complete"
          : tasks.some((task) => task.historical) ||
              (!sent.length && tasks.length > 0)
            ? "upcoming"
            : stage === 2
              ? "current"
              : "upcoming",
    },
    {
      label: "Return",
      detail: `${returned}/${request.items.length} received back`,
      state: stage > 3 ? "complete" : stage === 3 ? "current" : "upcoming",
    },
    {
      label: "Inspection",
      detail: complete ? "All clear" : "Condition check",
      state: stage > 4 ? "complete" : stage === 4 ? "current" : "upcoming",
    },
  ];
  if (!request.items.length) steps.splice(2);
  if (request.status === "Draft") {
    steps[0] = {
      label: "Draft",
      detail: "Not submitted yet",
      state: "current",
    };
    steps[1].state = "upcoming";
  }
  return {
    tasks,
    steps,
    label,
    description,
    closed,
    needsDelivery,
    review,
    complete,
    attention,
    filter: closed
      ? "closed"
      : review
        ? "approval"
        : needsDelivery
          ? "delivery"
          : tasks.length
            ? "returns"
            : "delivery",
  };
}
