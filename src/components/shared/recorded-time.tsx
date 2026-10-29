"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
/** Keep SSR deterministic; display actual records in the browser's local-time convention after hydration. */
export function RecordedTime({ value }: { value: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <time dateTime={value}>
      {hydrated
        ? new Date(value).toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : value.replace("T", " ")}
    </time>
  );
}
