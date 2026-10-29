/** Governed Vendor IDs used by workshop locations and internal Master Data. */
export const vendors = [
  { id: "vendor-prima", name: "Vendor Prima", city: "Bekasi" },
  { id: "vendor-karya", name: "Vendor Karya", city: "Tangerang" },
  { id: "vendor-abc-production", name: "ABC Production", city: "Jakarta / Bekasi" },
  { id: "vendor-xyz-fabrication", name: "XYZ Fabrication", city: "Tangerang" },
] as const;

export function getVendor(id?: string) {
  return vendors.find((vendor) => vendor.id === id);
}
