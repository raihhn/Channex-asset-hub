import { describe, expect, it } from "vitest";
import {
  catalogContactCandidates,
  internalContactDraft,
  internalContactIds,
} from "@/lib/domain/internal-contacts";
import { prototypeAssets } from "@/lib/fixtures/prototype-data";

describe("internal contact directory contracts", () => {
  it("rejects missing names, multiple emails, invalid IDs and duplicate assignments", () => {
    expect(() =>
      internalContactDraft({ name: "", email: "", phone: "" }),
    ).toThrow();
    expect(() =>
      internalContactDraft({
        name: "One",
        email: "a@example.com,b@example.com",
        phone: "",
      }),
    ).toThrow();
    expect(() => internalContactIds(["fixture-person"])).toThrow();
    const id = "11111111-1111-4111-8111-111111111111";
    expect(() => internalContactIds([id, id])).toThrow();
    expect(internalContactIds([])).toEqual([]);
    const lower = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(internalContactIds([lower.toUpperCase()])).toEqual([lower]);
    expect(() => internalContactIds([lower, lower.toUpperCase()])).toThrow();
  });
  it("imports an unambiguous single contact but never guesses two people from words", () => {
    const base = prototypeAssets[0];
    const candidates = catalogContactCandidates([
      {
        ...base,
        id: "one",
        responsiblePic: "A Long Personal Name",
        details: {
          ownerName: "",
          ownerEmail: "",
          picEmail: "one@example.com",
          eventName: "",
          setupName: "",
          reference: "",
          composition: "Unconfirmed",
          compositionNotes: "",
          confirmedDate: "",
          dateMeaning: "Unconfirmed",
        },
      },
      {
        ...base,
        id: "two",
        responsiblePic: "First Person Second Person",
        details: {
          ownerName: "",
          ownerEmail: "",
          picEmail: "one@example.com, two@example.com",
          eventName: "",
          setupName: "",
          reference: "",
          composition: "Unconfirmed",
          compositionNotes: "",
          confirmedDate: "",
          dateMeaning: "Unconfirmed",
        },
      },
    ]);
    expect(candidates[0].contacts).toEqual([
      { name: "A Long Personal Name", email: "one@example.com", phone: "" },
    ]);
    expect(candidates[1].reason).toBe("needs-confirmation");
    expect(candidates[1].contacts).toEqual([]);
  });
  it("reuses explicit saved pairs only for the identical name/email group", () => {
    const details = {
      ownerName: "",
      ownerEmail: "",
      picEmail: "one@example.com, two@example.com",
      eventName: "",
      setupName: "",
      reference: "",
      composition: "Unconfirmed" as const,
      compositionNotes: "",
      confirmedDate: "",
      dateMeaning: "Unconfirmed" as const,
    };
    const base = {
      ...prototypeAssets[0],
      responsiblePic: "First Person Second Person",
      details,
    };
    const contacts = [
      { name: "First Person", email: "one@example.com", phone: "" },
      { name: "Second Person", email: "two@example.com", phone: "" },
    ];
    const candidates = catalogContactCandidates([
      { ...base, id: "confirmed", managementContacts: contacts },
      { ...base, id: "same" },
      {
        ...base,
        id: "different",
        responsiblePic: "Different Person Second Person",
      },
    ]);
    expect(candidates[1].contacts).toEqual(contacts);
    expect(candidates[1].reason).toBe("confirmed-identical-group");
    expect(candidates[2].contacts).toEqual([]);
  });
});
