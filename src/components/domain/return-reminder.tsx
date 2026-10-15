"use client";
import Link from "next/link";
import { BellRing, ArrowRight } from "lucide-react";
import { Card, Button, Disclosure } from "@heroui/react";
import { useReturnReminders } from "@/components/shared/use-return-reminders";

export function ReturnReminder() {
  const due = useReturnReminders();
  if (!due.length) return null;
  return (
    <Card
      aria-label="Return reminders"
      className="border-warning/30 bg-warning-soft gap-3 border p-4"
    >
      <div className="flex items-start gap-3">
        <BellRing
          size={20}
          className="text-warning shrink-0"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-sm font-semibold">Assets need to be returned</h2>
          <p className="text-muted mt-1 text-xs">
            {due.reduce((count, entry) => count + entry.tasks.length, 0)} items
            across {due.length} bookings need attention.
          </p>
        </div>
      </div>
      <Disclosure>
        <Disclosure.Heading>
          <Button
            slot="trigger"
            size="sm"
            variant="ghost"
            className="w-full justify-between"
          >
            <span>View return reminders</span>
            <Disclosure.Indicator />
          </Button>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="grid gap-2 pt-3 sm:grid-cols-2">
            {due.map(({ request, tasks }) => (
              <Link
                key={request.id}
                className="border-warning/20 bg-surface flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                href={`/requests/${request.id}/return`}
              >
                <span className="min-w-0">
                  <strong className="block truncate">
                    {request.projectName ?? request.purpose}
                  </strong>
                  <small className="text-muted">
                    {tasks[0].state} · {tasks.length} item(s) ·{" "}
                    {tasks[0].dueAt.replace("T", " ")}
                  </small>
                </span>
                <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}
