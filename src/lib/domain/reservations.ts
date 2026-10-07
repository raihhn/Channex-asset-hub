import type {
  ActivationEvent,
  Asset,
  PrototypeRequest,
  ReturnReceipt,
  RequestStatus,
} from "@/types/prototype";

export type OperationalWindow = {
  outboundAt: string;
  inboundAt: string;
};

export type Reservation = OperationalWindow & {
  id: string;
  requestId: string;
  requestItemId: string;
  assetId: string;
  assetName: string;
  assetBrand: string;
  assetLocation: string;
  destination: string;
  quantity: number;
  activityName: string;
  eventId?: string;
  usageStartAt: string;
  usageEndAt: string;
  requestStatus: RequestStatus;
  blocksAvailability: boolean;
  /** Derived only from an authoritative Return receipt; never from Request status. */
  actualInboundAt?: string;
};

/** Prototype activation point: submission / Pending approval, not final policy. */
const nonBlockingStatuses = new Set<RequestStatus>([
  "Draft",
  "Rejected",
  "Cancelled",
]);

export function blocksAssetAvailability(status: RequestStatus) {
  return !nonBlockingStatuses.has(status);
}

function localDateTime(date: string, time: string) {
  return `${date}T${time}`;
}

export function localDateTimeKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function actualInboundLocalKey(actualInboundAt: string) {
  return localDateTimeKey(new Date(actualInboundAt));
}

export function getOperationalWindowFromFields(
  outboundDate: string,
  outboundTime: string,
  inboundDate: string,
  inboundTime: string,
): OperationalWindow {
  return {
    outboundAt: localDateTime(outboundDate, outboundTime),
    inboundAt: localDateTime(inboundDate, inboundTime),
  };
}

export function getOperationalWindow(
  request: PrototypeRequest,
): OperationalWindow {
  return getOperationalWindowFromFields(
    request.pickupDate ?? request.startDate,
    request.pickupTime ?? "00:00",
    request.returnDate ?? request.endDate,
    request.returnTime ?? "23:59",
  );
}

export function validateOperationalWindow(
  usageStartDate: string,
  usageEndDate: string,
  window: OperationalWindow,
) {
  const outboundDate = window.outboundAt.slice(0, 10);
  const inboundDate = window.inboundAt.slice(0, 10);
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00`));
  const validTime = (value: string) =>
    /^\d{2}:\d{2}$/.test(value) &&
    Number(value.slice(0, 2)) < 24 &&
    Number(value.slice(3, 5)) < 60;
  const outboundTime = window.outboundAt.slice(11, 16);
  const inboundTime = window.inboundAt.slice(11, 16);

  if (
    !validDate(usageStartDate) ||
    !validDate(usageEndDate) ||
    !validDate(outboundDate) ||
    !validDate(inboundDate) ||
    !validTime(outboundTime) ||
    !validTime(inboundTime) ||
    usageEndDate < usageStartDate
  ) {
    return { valid: false, error: "Enter valid usage and logistics dates." };
  }
  if (window.inboundAt < window.outboundAt) {
    return { valid: false, error: "Inbound must not be before outbound." };
  }
  if (outboundDate > usageStartDate) {
    return {
      valid: false,
      error: "Outbound must be on or before the usage start date.",
    };
  }
  if (inboundDate < usageEndDate) {
    return {
      valid: false,
      error: "Inbound must be on or after the usage end date.",
    };
  }
  return { valid: true, error: "" };
}

/** Uses half-open timestamp windows so one reservation may start as another ends. */
export function operationalWindowsOverlap(
  first: OperationalWindow,
  second: OperationalWindow,
) {
  return (
    first.outboundAt < second.inboundAt && first.inboundAt > second.outboundAt
  );
}

export function deriveReservations(
  requests: PrototypeRequest[],
  assets: Asset[],
  events: ActivationEvent[],
  receipts: ReturnReceipt[] = [],
): Reservation[] {
  return requests.flatMap((request) => {
    const window = getOperationalWindow(request);
    const event = events.find((candidate) => candidate.id === request.eventId);
    const activityName =
      event?.name ??
      request.activityName ??
      request.projectName ??
      request.purpose;
    return request.items.flatMap((item) => {
      const asset = assets.find((candidate) => candidate.id === item.assetId);
      if (!asset) return [];
      const receipt = receipts.find(
        (candidate) =>
          candidate.requestId === request.id &&
          candidate.requestItemId === item.id &&
          candidate.assetId === item.assetId &&
          candidate.receivedAt,
      );
      return [
        {
          id: item.id,
          requestId: request.id,
          requestItemId: item.id,
          assetId: asset.id,
          assetName: asset.name,
          assetBrand: request.brand ?? event?.brand ?? asset.brand,
          assetLocation: asset.location,
          destination: request.destination,
          quantity: item.quantity,
          activityName,
          eventId: request.eventId,
          usageStartAt: `${request.startDate}T00:00`,
          usageEndAt: `${request.endDate}T23:59`,
          requestStatus: request.status,
          blocksAvailability: blocksAssetAvailability(request.status),
          ...(receipt?.receivedAt
            ? { actualInboundAt: receipt.receivedAt }
            : {}),
          ...window,
        },
      ];
    });
  });
}

export function getReservationConflicts(
  asset: Asset,
  window: OperationalWindow,
  reservations: Reservation[],
  now = localDateTimeKey(new Date()),
) {
  // An Asset ID is treated as one reservable identity until stock allocation
  // has an approved model. Quantity limits remain a separate fixture check.
  return reservations.filter(
    (reservation) =>
      reservation.assetId === asset.id &&
      reservation.blocksAvailability &&
      operationalWindowsOverlap(window, {
        outboundAt: reservation.outboundAt,
        inboundAt: reservation.actualInboundAt
          ? actualInboundLocalKey(reservation.actualInboundAt)
          : reservation.inboundAt < now
            ? "9999-12-31T23:59"
            : reservation.inboundAt,
      }),
  );
}

export function getReservationPhaseState(
  reservation: Reservation,
  phase: "Outbound" | "Event usage" | "Inbound",
  now: string,
) {
  if (phase === "Outbound") {
    if (now.slice(0, 10) > reservation.outboundAt.slice(0, 10))
      return "Awaiting confirmation";
    return now.slice(0, 10) === reservation.outboundAt.slice(0, 10)
      ? "Due"
      : "Upcoming";
  }
  if (phase === "Event usage") {
    return now >= reservation.usageStartAt && now <= reservation.usageEndAt
      ? "Planned usage window"
      : "Scheduled for use";
  }
  if (reservation.actualInboundAt) return "Completed";
  if (now > reservation.inboundAt) return "Late";
  return now.slice(0, 10) === reservation.inboundAt.slice(0, 10)
    ? "Due"
    : "Upcoming";
}
