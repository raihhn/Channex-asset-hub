"use client";
import { useSyncExternalStore } from "react";
import { localDateTimeKey } from "@/lib/domain/reservations";
const subscribe = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
};
const snapshot = () => localDateTimeKey(new Date());
// A deterministic hydration snapshot avoids interpreting server timezone as the user's local clock.
const serverSnapshot = () => "";
export function useLocalNow() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
