"use client";
import { useState, type ReactNode } from "react";
import { Button, Disclosure } from "@heroui/react";

/** Mount closed operational forms on first open, then preserve their unsaved input. */
export function WorkflowDisclosure({
  title,
  children,
  variant = "secondary",
  className = "",
}: {
  title: string;
  children: ReactNode;
  variant?: "secondary" | "ghost";
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  return (
    <Disclosure
      className={className}
      isExpanded={expanded}
      onExpandedChange={(open) => {
        setExpanded(open);
        if (open) setHasOpened(true);
      }}
    >
      <Disclosure.Heading>
        <Button
          slot="trigger"
          variant={variant}
          className="w-full justify-between"
        >
          <span>{title}</span>
          <Disclosure.Indicator />
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="grid gap-4 pt-4">
          {hasOpened ? children : null}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
