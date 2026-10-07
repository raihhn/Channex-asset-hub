import { describe, expect, it } from "vitest";

import { normalizeWbsCode, uniqueWbsCodes } from "@/lib/domain/wbs-references";

describe("manual WBS reference handling", () => {
  it("trims entries and ignores blank and exact duplicate codes", () => {
    expect(normalizeWbsCode("  ABC12345  ")).toBe("ABC12345");
    expect(uniqueWbsCodes([" ABC12345 ", "", "ABC12345", "abc12345"])).toEqual([
      "ABC12345",
      "abc12345",
    ]);
  });
});
