export type AdminRow = Record<string, string>;

import { vendors } from "@/lib/fixtures/vendors";
import { brandReferences, categoryReferences } from "@/lib/fixtures/organization";

export const administrationData: Record<
  string,
  { title: string; eyebrow: string; columns: string[]; rows: AdminRow[] }
> = {
  brands: {
    title: "Brand",
    eyebrow: "Master data",
    columns: ["Name", "Code", "Status"],
    rows: brandReferences.map((item) => ({ Name: item.name, Code: item.id, Status: item.status })),
  },
  events: {
    title: "Events",
    eyebrow: "Master data",
    columns: ["Name", "Brand", "Parent event", "Location", "Dates", "Status"],
    rows: [],
  },
  categories: {
    title: "Category",
    eyebrow: "Master data",
    columns: ["Name", "Code", "Status"],
    rows: categoryReferences.map((item) => ({ Name: item.name, Code: item.id, Status: item.status })),
  },
  "warehouses-vendors": {
    title: "Warehouse & Vendor",
    eyebrow: "Master data",
    columns: ["Name", "Type", "Location", "Status"],
    rows: [
      {
        Name: "Jakarta Hub",
        Type: "Internal warehouse",
        Location: "Jakarta",
        Status: "Active",
      },
      {
        Name: "Bandung Hub",
        Type: "Internal warehouse",
        Location: "Bandung",
        Status: "Active",
      },
      ...vendors.map((vendor) => ({
        Name: vendor.name,
        Type: "Vendor",
        Location: vendor.city,
        Status: "Active",
      })),
    ],
  },
  divisions: {
    title: "Division",
    eyebrow: "Master data",
    columns: ["Name", "Code", "Status"],
    rows: [
      { Name: "Brand Experience", Code: "BEX", Status: "Active" },
      { Name: "Commercial", Code: "COM", Status: "Active" },
      { Name: "Operations", Code: "OPS", Status: "Active" },
    ],
  },
  "approval-matrix": {
    title: "Approval Matrix",
    eyebrow: "Master data",
    columns: ["Scope", "Step", "Approver", "Status"],
    rows: [
      {
        Scope: "All booth requests",
        Step: "Operations review",
        Approver: "Dian Rahma",
        Status: "Active",
      },
      {
        Scope: "Make Over assets",
        Step: "Condition review",
        Approver: "Fira Lestari",
        Status: "Active",
      },
      {
        Scope: "Vendor-held assets",
        Step: "Vendor confirmation",
        Approver: "Operations team",
        Status: "Active",
      },
    ],
  },
};
