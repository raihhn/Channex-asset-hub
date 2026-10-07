import type { FulfillmentGroup, RequestItem, ReturnGroup } from "@/types/prototype";

export class AmbiguousLegacyGroupError extends Error {
  constructor(value: string) {
    super(`Cannot map group member ${value} to exactly one RequestItem.`);
    this.name = "AmbiguousLegacyGroupError";
  }
}

/** Existing groups contain Asset IDs. Only an exact, unique match may migrate. */
export function normalizeGroupItemIds<T extends FulfillmentGroup | ReturnGroup>(
  groups: T[] | undefined,
  items: RequestItem[],
): T[] | undefined {
  return groups?.map((group) => ({
    ...group,
    itemIds: group.itemIds.map((member) => {
      if (items.some((item) => item.id === member)) return member;
      const matches = items.filter((item) => item.assetId === member);
      if (matches.length !== 1) throw new AmbiguousLegacyGroupError(member);
      return matches[0].id;
    }),
  }));
}

/** Selection currently allows only one line per Asset; preserve the line on revision. */
export function preserveRequestItemIds(
  prior: RequestItem[],
  next: Array<Omit<RequestItem, "id">>,
  createId: () => string,
): RequestItem[] {
  const seen = new Set<string>();
  return next.map((item) => {
    if (seen.has(item.assetId)) throw new Error("An Asset may appear only once in a Request.");
    seen.add(item.assetId);
    return { ...item, id: prior.find((old) => old.assetId === item.assetId)?.id ?? createId() };
  });
}
