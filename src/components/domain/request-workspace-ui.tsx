import type { ReactNode } from "react";
import { Card, Chip } from "@heroui/react";
import { Check, Package, CalendarDays, MapPin } from "lucide-react";

export function RequestSteps({ step }: { step: number }) {
  return (
    <nav
      aria-label="Request steps"
      className="border-border bg-surface grid grid-cols-4 gap-2 rounded-2xl border p-3 sm:p-4"
    >
      {["Usage & dates", "Select assets", "Fulfillment", "Review & submit"].map(
        (label, index) => (
          <div
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
            className={`flex min-w-0 flex-col items-center gap-2 rounded-xl p-2 text-center sm:flex-row sm:text-left ${step === index + 1 ? "bg-accent-soft text-accent" : "text-muted"}`}
          >
            <Chip
              color={step >= index + 1 ? "accent" : "default"}
              variant={step === index + 1 ? "primary" : "soft"}
              aria-hidden="true"
            >
              {step > index + 1 ? <Check className="size-4" /> : index + 1}
            </Chip>
            <span className="text-xs font-medium sm:text-sm">{label}</span>
          </div>
        ),
      )}
    </nav>
  );
}

export function RequestSummary({
  title,
  project,
  dates,
  destination,
  children,
}: {
  title: string;
  project: string;
  dates: string;
  destination: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-border gap-5 border p-5 sm:p-6">
      <Card.Header className="gap-2">
        <div className="text-muted flex items-center gap-2">
          <Package className="size-4" aria-hidden="true" />
          <span className="text-xs font-medium">Request summary</span>
        </div>
        <Card.Title className="text-lg">{title}</Card.Title>
      </Card.Header>
      <Card.Content className="border-border space-y-4 border-y py-4">
        <p className="text-sm font-semibold break-words">{project}</p>
        <div className="text-muted flex items-start gap-2 text-xs">
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          <span>{dates}</span>
        </div>
        <div className="text-muted flex items-start gap-2 text-xs">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2" title={destination}>
            {destination}
          </span>
        </div>
      </Card.Content>
      {children}
    </Card>
  );
}
