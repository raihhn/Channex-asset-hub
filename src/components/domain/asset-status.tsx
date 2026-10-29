import type { AssetAvailability } from "@/types/prototype";
import { Chip } from "@heroui/react";

const labels: Record<AssetAvailability, string> = {
  available: "Available",
  reserved: "Reserved",
  "in-use": "In use",
  maintenance: "Maintenance",
  unavailable: "Unavailable",
};

const colors: Record<
  AssetAvailability,
  "success" | "accent" | "warning" | "danger"
> = {
  available: "success",
  reserved: "accent",
  "in-use": "warning",
  maintenance: "warning",
  unavailable: "danger",
};

export function AssetStatus({ status }: { status: AssetAvailability }) {
  return (
    <Chip
      className="asset-status"
      color={colors[status]}
      size="sm"
      variant="soft"
    >
      {labels[status]}
    </Chip>
  );
}
