import { Check } from "lucide-react";
import type { JourneyStep } from "@/lib/domain/request-journey";

export function JourneyTimeline({
  steps,
  compact = false,
}: {
  steps: JourneyStep[];
  compact?: boolean;
}) {
  const columns =
    steps.length === 4
      ? "sm:grid-cols-4"
      : steps.length === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-5";
  return (
    <ol
      aria-label="Tracking progress"
      className={`grid gap-3 ${compact ? (steps.length === 2 ? "grid-cols-2" : "grid-cols-5") : columns}`}
    >
      {steps.map((step, index) => (
        <li
          key={step.label}
          aria-current={step.state === "current" ? "step" : undefined}
          className={`flex min-w-0 gap-3 ${compact ? "flex-col gap-2" : "sm:flex-col"}`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.state === "complete" ? "bg-accent text-accent-foreground" : step.state === "current" ? "border-accent text-accent border-2" : "border-border text-muted border"}`}
            >
              {step.state === "complete" ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                index + 1
              )}
            </span>
            <span
              aria-hidden="true"
              className={`hidden h-px flex-1 sm:block ${step.state === "complete" ? "bg-accent" : "bg-border"}`}
            />
          </div>
          <div className="min-w-0">
            <p
              className={`${compact ? "text-xs" : "text-sm"} font-medium ${step.state === "upcoming" ? "text-muted" : "text-foreground"}`}
            >
              {step.label}
            </p>
            {!compact && (
              <p className="text-muted mt-1 text-xs break-words">
                {step.detail}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
