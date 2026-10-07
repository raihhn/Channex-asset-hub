/** Organizational scope IDs. None of these create a physical Location or warehouse. */
export const areas = [
  { id: "area-jabodetabek", name: "Jabodetabek" },
  { id: "area-sumatra", name: "Sumatra" },
  { id: "area-east-java", name: "East Java" },
] as const;

export const distributionCenters = [
  { id: "dc-jakarta", name: "DC Jakarta", areaId: "area-jabodetabek" },
  { id: "dc-bengkulu", name: "DC Bengkulu", areaId: "area-sumatra" },
  { id: "dc-surabaya", name: "DC Surabaya", areaId: "area-east-java" },
] as const;

export const brandReferences = [
  { id: "WRD", name: "Wardah", status: "Active" },
  { id: "EMN", name: "Emina", status: "Active" },
  { id: "KHF", name: "Kahf", status: "Active" },
  { id: "MKO", name: "Make Over", status: "Active" },
  { id: "TVI", name: "Tavi", status: "Inactive" },
] as const;

export const categoryReferences = [
  { id: "BOOTH", name: "Current Booth", status: "Active" },
  { id: "MOD", name: "Modular Booth", status: "Active" },
  { id: "POSM", name: "POSM", status: "Active" },
  { id: "DISPLAY", name: "Display", status: "Active" },
  { id: "SUPPORT", name: "Supporting Asset", status: "Active" },
] as const;
