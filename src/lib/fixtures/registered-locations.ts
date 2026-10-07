export type RegisteredLocation = {
  id: string;
  type: "Internal warehouse" | "Vendor warehouse" | "Vendor workshop" | "Store";
  name: string;
  address: string;
  city: string;
  vendorId?: string;
  vendorName?: string;
  contact?: string;
};

export const registeredLocations: RegisteredLocation[] = [
  {
    id: "store-senayan-city",
    type: "Store",
    name: "Wardah Store — Senayan City",
    address: "Senayan City, Jakarta",
    city: "Jakarta",
  },
  {
    id: "store-pakuwon-surabaya",
    type: "Store",
    name: "Emina Store — Pakuwon Mall",
    address: "Pakuwon Mall, Surabaya",
    city: "Surabaya",
  },
  {
    id: "warehouse-jakarta-hub",
    type: "Internal warehouse",
    name: "Jakarta Hub",
    address: "Jl. Raya Cakung Cilincing No. 12",
    city: "Jakarta",
    contact: "Asset Operations",
  },
  {
    id: "vendor-abc-cakung",
    type: "Vendor workshop",
    name: "Cakung Production Workshop",
    address: "Jl. Bekasi Raya KM 24",
    city: "Jakarta Timur",
    vendorId: "vendor-abc-production",
    vendorName: "ABC Production",
    contact: "Bima · 0812 8800 1122",
  },
  {
    id: "vendor-abc-bekasi",
    type: "Vendor workshop",
    name: "Bekasi Assembly Workshop",
    address: "Jl. Industri Selatan Blok C",
    city: "Bekasi",
    vendorId: "vendor-abc-production",
    vendorName: "ABC Production",
    contact: "Sari · 0812 8800 3344",
  },
  {
    id: "vendor-xyz-tangerang",
    type: "Vendor workshop",
    name: "Tangerang Fabrication Workshop",
    address: "Jl. Daan Mogot No. 88",
    city: "Tangerang",
    vendorId: "vendor-xyz-fabrication",
    vendorName: "XYZ Fabrication",
    contact: "Rudi · 0813 7700 9911",
  },
];

export function getRegisteredLocation(id?: string) {
  return registeredLocations.find((location) => location.id === id);
}
