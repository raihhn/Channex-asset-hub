import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { AssetContactFields } from "@/features/assets/asset-contact-fields";
import {
  validateAssetContacts,
  type AssetContact,
} from "@/lib/domain/asset-contacts";
import { assetEditDefaults, validateAssetEdit } from "@/lib/domain/asset-edit";
import { prototypeAssets } from "@/lib/fixtures/prototype-data";

describe("asset management contacts", () => {
  it("preserves explicit name/email/phone pairs and permits optional contact channels", () => {
    expect(
      validateAssetContacts([
        { name: " First ", email: "first@example.com", phone: "+62 812" },
        { name: "Second", email: "", phone: "" },
      ]),
    ).toEqual([
      { name: "First", email: "first@example.com", phone: "+62 812" },
      { name: "Second", email: "", phone: "" },
    ]);
  });
  it("omits wholly blank rows but rejects unnamed or invalid multi-email contacts", () => {
    expect(validateAssetContacts([{ name: "", email: "", phone: "" }])).toEqual(
      [],
    );
    expect(() =>
      validateAssetContacts([
        { name: "", email: "first@example.com", phone: "" },
      ]),
    ).toThrow();
    expect(() =>
      validateAssetContacts([
        {
          name: "First",
          email: "first@example.com,second@example.com",
          phone: "",
        },
      ]),
    ).toThrow();
    expect(() => validateAssetContacts([null])).toThrow();
  });
  it("does not guess pairs from legacy concatenated names/emails or change historical references", () => {
    const asset = {
      ...prototypeAssets[0],
      responsiblePic: "First Person Second Person",
    };
    const edit = assetEditDefaults(asset);
    expect(edit.managementContacts).toEqual([]);
    const saved = validateAssetEdit({
      ...edit,
      managementContacts: [
        { name: "First Person", email: "first@example.com", phone: "123" },
      ],
    });
    expect(saved.managementContacts?.[0].name).toBe("First Person");
    expect(saved.responsiblePic).toBe(asset.responsiblePic);
    expect(saved.details.reference).toBe(edit.details.reference);
    const { managementContacts: _unused, ...legacyEdit } = edit;
    expect(validateAssetEdit(legacyEdit)).not.toHaveProperty(
      "managementContacts",
    );
  });
  it("adds and removes independent rows without moving contact values between people", () => {
    function Harness() {
      const [contacts, setContacts] = useState<AssetContact[]>([]);
      return <AssetContactFields value={contacts} onChange={setContacts} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah PIC" }));
    fireEvent.change(screen.getByLabelText("Nama PIC 1"), {
      target: { value: "First" },
    });
    fireEvent.change(screen.getByLabelText("Email PIC 1"), {
      target: { value: "first@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tambah PIC" }));
    fireEvent.change(screen.getByLabelText("Nama PIC 2"), {
      target: { value: "Second" },
    });
    fireEvent.change(screen.getByLabelText("Telepon PIC 2"), {
      target: { value: "456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hapus PIC 1" }));
    expect(screen.getByLabelText("Nama PIC 1")).toHaveValue("Second");
    expect(screen.getByLabelText("Email PIC 1")).toHaveValue("");
    expect(screen.getByLabelText("Telepon PIC 1")).toHaveValue("456");
    expect(
      within(
        screen.getByRole("group", { name: "PIC pengelola asset" }),
      ).queryByLabelText("Nama PIC 2"),
    ).toBeNull();
  });
});
