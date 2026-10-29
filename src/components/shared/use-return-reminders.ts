"use client";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { deriveReturnTasks } from "@/lib/domain/request-journey";
import { useLocalNow } from "@/components/shared/use-local-now";
export function useReturnReminders() {
  const {
    requests,
    outboundDispatches,
    returnReceipts,
    currentUser,
    bookingLoading,
    bookingError,
  } = usePrototype();
  const now = useLocalNow();
  if (bookingLoading || bookingError) return [];
  return requests
    .filter(
      (request) =>
        currentUser.roles.includes("SUPER_ADMIN") ||
        request.submittedByUserId === currentUser.id,
    )
    .map((request) => ({
      request,
      tasks: deriveReturnTasks(
        request,
        outboundDispatches,
        returnReceipts,
        now,
      ).filter((task) => task.overdue || task.state === "Due today"),
    }))
    .filter((entry) => entry.tasks.length);
}
