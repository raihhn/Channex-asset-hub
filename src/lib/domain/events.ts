import type { ActivationEvent } from "@/types/prototype";

export function getSubEvents(events: ActivationEvent[], parentEventId: string) {
  return events.filter((event) => event.parentEventId === parentEventId);
}

export function getParentEvent(
  events: ActivationEvent[],
  event: ActivationEvent,
) {
  return event.parentEventId
    ? events.find((candidate) => candidate.id === event.parentEventId)
    : undefined;
}

export function getSelectableEvents(events: ActivationEvent[], brand: string) {
  const parentIds = new Set(
    events.flatMap((event) => event.parentEventId ? [event.parentEventId] : []),
  );
  return events.filter(
    (event) =>
      event.brand === brand &&
      event.status !== "Completed" &&
      !parentIds.has(event.id),
  );
}

export function getEventPickerLabel(
  events: ActivationEvent[],
  event: ActivationEvent,
) {
  const parent = getParentEvent(events, event);
  return [event.name, event.city, parent ? `Parent: ${parent.name}` : undefined]
    .filter(Boolean)
    .join(" · ");
}

export function isValidEventParent(
  events: ActivationEvent[],
  eventId: string,
  parentEventId?: string | null,
) {
  if (!parentEventId) return true;
  if (eventId === parentEventId) return false;
  let currentId: string | undefined = parentEventId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === eventId || visited.has(currentId)) return false;
    visited.add(currentId);
    currentId = events.find((event) => event.id === currentId)?.parentEventId ?? undefined;
  }
  return true;
}

/** Calendar-date usage is inclusive: the start and end dates both count. */
export function getBoothUsageDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function getBoothUsageValidation(
  boothType: "Regular Booth" | "Custom Booth" | undefined,
  startDate: string,
  endDate: string,
) {
  if (!boothType) return { usageDays: 0, exceedsLimit: false, invalidDateRange: false };
  const usageDays = getBoothUsageDays(startDate, endDate);
  return { usageDays, exceedsLimit: usageDays > 30, invalidDateRange: usageDays === 0 };
}
