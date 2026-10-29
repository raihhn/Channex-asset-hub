import type { Asset } from "@/types/prototype";
import type { RegisteredLocation } from "@/lib/fixtures/registered-locations";

/** Directory contact for the recorded warehouse, never evidence of physical custody. */
export function currentWarehouseContact(
  asset: Asset,
  locations: RegisteredLocation[],
) {
  if (
    !asset.warehouseId ||
    !["Vendor warehouse", "Vendor storage", "Vendor workshop"].includes(
      asset.locationType,
    )
  )
    return undefined;
  const location = locations.find(
    (location) => location.id === asset.warehouseId,
  );
  if (
    !location?.vendorId ||
    !location.contact ||
    location.name !== asset.location ||
    (asset.vendorId && location.vendorId !== asset.vendorId)
  )
    return undefined;
  return location.contact;
}
