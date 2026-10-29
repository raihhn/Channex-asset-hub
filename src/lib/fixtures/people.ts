import type { Person } from "@/types/identity";

const fixtureDate = "2026-10-07T00:00:00+07:00";

/** One canonical list. Admin tables and actor selectors derive from this list. */
export const peopleFixtures: Person[] = [
  { id: "dev-user", name: "Raihan Pradana", email: "raihan.pradana@paragon.co.id", roles: ["REQUESTER", "SUPER_ADMIN"], status: "ACTIVE", brandIds: ["WRD", "EMN"], categoryIds: [], areaIds: ["area-jabodetabek"], dcIds: ["dc-jakarta"], createdAt: fixtureDate, updatedAt: fixtureDate },
  { id: "user-storedev", name: "Dian Rahma", email: "dian.rahma@paragon.co.id", roles: ["STORE_DEV"], status: "ACTIVE", brandIds: ["WRD", "KHF"], categoryIds: ["BOOTH", "MOD", "POSM"], areaIds: ["area-jabodetabek", "area-sumatra"], dcIds: ["dc-jakarta", "dc-bengkulu"], createdAt: fixtureDate, updatedAt: fixtureDate },
  { id: "user-brand", name: "Nadia Prasetyo", email: "nadia.prasetyo@paragon.co.id", roles: ["BRAND"], status: "ACTIVE", brandIds: ["EMN"], categoryIds: [], areaIds: [], dcIds: [], createdAt: fixtureDate, updatedAt: fixtureDate },
  { id: "user-vendor", name: "Bima Vendor", email: "bima.vendor@example.com", roles: ["VENDOR"], status: "ACTIVE", brandIds: [], categoryIds: [], areaIds: [], dcIds: [], vendorId: "vendor-abc-production", createdAt: fixtureDate, updatedAt: fixtureDate },
  { id: "user-management", name: "Fira Lestari", email: "fira.lestari@paragon.co.id", roles: ["MANAGEMENT"], status: "ACTIVE", brandIds: [], categoryIds: [], areaIds: [], dcIds: [], createdAt: fixtureDate, updatedAt: fixtureDate },
];

export const defaultCurrentUserId = "dev-user";
