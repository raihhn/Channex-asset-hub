import type { RequestStatus as RequestStatusValue } from "@/types/prototype";
import { Chip } from "@heroui/react";

const colors: Record<
  RequestStatusValue,
  "default" | "accent" | "success" | "warning" | "danger"
> = {
  "Pending approval": "warning",
  Approved: "success",
  Rejected: "danger",
  Cancelled: "default",
  Draft: "default",
  Ready: "success",
  "Return due": "warning",
  "Inspection pending": "warning",
  Overdue: "danger",
  "Needs update": "warning",
  "In use": "accent",
  Completed: "success",
};

export function RequestStatus({ status }: { status: RequestStatusValue }) {
  return (
    <Chip
      className="request-status"
      color={colors[status]}
      size="sm"
      variant="soft"
    >
      {status}
    </Chip>
  );
}
