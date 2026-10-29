export const primaryNavigation = [
  { label: "Today", area: "home", href: "/" },
  { label: "Inventory", area: "assets", href: "/assets" },
  { label: "Requests", area: "requests", href: "/requests" },
] as const;

export const desktopSecondaryNavigation = [
  { label: "Monitoring", href: "/operations" },
  { label: "Transfers", href: "/transfers" },
  { label: "Reports", href: "/reports" },
  { label: "Master Data", href: "/admin" },
] as const;

export const administrationNavigation = [
  { label: "Brand", slug: "brands" },
  { label: "Category", slug: "categories" },
  { label: "Warehouse & Vendor", slug: "warehouses-vendors" },
  { label: "Division", slug: "divisions" },
  { label: "Users", slug: "users" },
  { label: "Audit Trail", slug: "audit" },
  { label: "Approval Matrix", slug: "approval-matrix" },
] as const;
