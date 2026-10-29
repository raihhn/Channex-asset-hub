"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchVendorLocations } from "@/lib/vendor-locations-client";
import type { RegisteredLocation } from "@/lib/fixtures/registered-locations";
export function useVendorLocations(actorId: string) {
  const path = usePathname();
  const key = `${actorId}:${path}`;
  const [state, setState] = useState<{
    key: string;
    locations: RegisteredLocation[];
    error: string;
  }>({ key: "", locations: [], error: "" });
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      fetchVendorLocations(actorId, controller.signal)
        .then((locations) => setState({ key, locations, error: "" }))
        .catch((error: Error) => {
          if (error.name !== "AbortError")
            setState({ key, locations: [], error: error.message });
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [actorId, key]);
  return {
    vendorLocations: state.locations,
    vendorLoading: state.key !== key,
    vendorError: state.key === key ? state.error : "",
  };
}
