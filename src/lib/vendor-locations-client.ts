import { actorFetch } from "./actor-client";
import type { RegisteredLocation } from "@/lib/fixtures/registered-locations";
export async function fetchVendorLocations(
  _actorId: string,
  signal?: AbortSignal,
): Promise<RegisteredLocation[]> {
  const response = await actorFetch("/api/vendor-locations", {
    cache: "no-store",
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error?.code ?? data.message ?? "Could not load vendor warehouses.",
    );
  return data;
}
export async function validateVendorLocation(
  id: string,
  actorId: string,
): Promise<RegisteredLocation> {
  const rows = await fetchVendorLocations(actorId);
  const location = rows.find((row) => row.id === id);
  if (!location)
    throw new Error(
      "This vendor warehouse is inactive, incomplete, or no longer available. Choose another destination.",
    );
  return location;
}
