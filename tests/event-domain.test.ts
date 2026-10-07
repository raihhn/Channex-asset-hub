import { describe, expect, it } from "vitest";

import { activationEvents } from "@/lib/fixtures/activation-events";
import {
  getBoothUsageDays,
  getBoothUsageValidation,
  getEventPickerLabel,
  getParentEvent,
  getSelectableEvents,
  getSubEvents,
  isValidEventParent,
} from "@/lib/domain/events";

describe("registered Event hierarchy", () => {
  it("shows parent and child context while selecting only active instances by brand", () => {
    const children = getSubEvents(activationEvents, "EVT-WRD-MASTER-2026");
    expect(children).toHaveLength(2);
    const child = children[0];
    expect(getParentEvent(activationEvents, child)?.name).toBe("Wardah Beauty Festival 2026");
    expect(getEventPickerLabel(activationEvents, child)).toContain("Parent: Wardah Beauty Festival 2026");
    expect(getSelectableEvents(activationEvents, "Wardah").map((event) => event.id)).not.toContain("EVT-WRD-MASTER-2026");
    expect(getSelectableEvents(activationEvents, "Kahf").map((event) => event.id)).toContain("EVT-KHF-004");
  });

  it("rejects self and indirect parent cycles", () => {
    expect(isValidEventParent(activationEvents, "EVT-WRD-026", "EVT-WRD-026")).toBe(false);
    expect(isValidEventParent(activationEvents, "EVT-WRD-MASTER-2026", "EVT-WRD-026")).toBe(false);
    expect(isValidEventParent(activationEvents, "EVT-WRD-019", "EVT-WRD-MASTER-2026")).toBe(true);
  });
});

describe("booth usage policy", () => {
  it("counts inclusive calendar dates and allows at most 30 days", () => {
    expect(getBoothUsageDays("2026-08-12", "2026-08-12")).toBe(1);
    expect(getBoothUsageDays("2026-08-01", "2026-08-30")).toBe(30);
    expect(getBoothUsageValidation("Regular Booth", "2026-08-01", "2026-08-30").exceedsLimit).toBe(false);
    expect(getBoothUsageValidation("Custom Booth", "2026-08-01", "2026-08-31").exceedsLimit).toBe(true);
    expect(getBoothUsageValidation("Regular Booth", "2026-08-31", "2026-08-01").invalidDateRange).toBe(true);
    expect(getBoothUsageValidation(undefined, "2026-08-01", "2026-09-30").exceedsLimit).toBe(false);
  });
});
