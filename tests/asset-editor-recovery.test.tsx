import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AssetEditor } from "@/features/assets/asset-editor";
import { prototypeAssets } from "@/lib/fixtures/prototype-data";
import { peopleFixtures } from "@/lib/fixtures/people";

const mocks = vi.hoisted(() => ({ edit: vi.fn(), renew: vi.fn() }));
vi.mock("@/features/prototype/prototype-provider", () => ({
  usePrototype: () => ({
    currentUser: { ...peopleFixtures[0], roles: ["SUPER_ADMIN"] },
    editAsset: mocks.edit,
  }),
}));
vi.mock("@/lib/actor-client", async (original) => ({
  ...(await original<typeof import("@/lib/actor-client")>()),
  selectDevelopmentPerson: mocks.renew,
}));
vi.mock("@/features/assets/asset-contact-picker", () => ({
  AssetContactPicker: ({
    onChange,
    selectedContacts = [],
    single = false,
  }: {
    onChange: (
      ids: string[],
      contacts: { name: string; email: string; phone: string }[],
    ) => void;
    single?: boolean;
    selectedContacts?: { name: string; email: string; phone: string }[];
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onChange(
            ["11111111-1111-4111-8111-111111111111"],
            [{ name: "Unsent Person", email: "unsent@example.com", phone: "" }],
          )
        }
      >
        {single ? "Pilih Owner pengujian" : "Pilih PIC pengujian"}
      </button>
      {selectedContacts.map((c) => (
        <p key={c.email}>
          {c.name} · {c.email}
        </p>
      ))}
    </div>
  ),
}));
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("asset editor session recovery", () => {
  it("preserves unsaved paired PICs, explicitly renews the same actor and never auto-retries a command", async () => {
    mocks.edit
      .mockRejectedValueOnce(new Error("LOCAL_SESSION_REQUIRED"))
      .mockResolvedValue(undefined);
    mocks.renew.mockResolvedValue(peopleFixtures[0]);
    render(<AssetEditor asset={prototypeAssets[0]} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit asset" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Pilih PIC pengujian" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "isian form tetap ada",
    );
    expect(screen.queryByText("LOCAL_SESSION_REQUIRED")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Aktifkan kembali sesi sebagai/ }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Sesi aktif kembali",
      ),
    );
    expect(mocks.renew).toHaveBeenCalledWith(peopleFixtures[0].id);
    expect(mocks.edit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Unsent Person · unsent@example.com"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    await waitFor(() => expect(mocks.edit).toHaveBeenCalledTimes(2));
    expect(mocks.edit.mock.calls[1][1].managementContacts).toEqual([
      { name: "Unsent Person", email: "unsent@example.com", phone: "" },
    ]);
  });
  it("retains the draft if renewed identity is rejected without choosing a replacement", async () => {
    mocks.edit.mockRejectedValue(new Error("LOCAL_SESSION_INVALID"));
    mocks.renew.mockRejectedValue(new Error("CANONICAL_PERSON_UNAVAILABLE"));
    render(<AssetEditor asset={prototypeAssets[0]} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit asset" }));
    fireEvent.change(screen.getByLabelText("Nama asset"), {
      target: { value: "Unsaved name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Aktifkan kembali sesi sebagai/,
      }),
    );
    await waitFor(() => expect(mocks.renew).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Simpan perubahan" }),
      ).toBeEnabled(),
    );
    expect(screen.getByLabelText("Nama asset")).toHaveValue("Unsaved name");
    expect(mocks.edit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Perubahan belum tersimpan",
    );
  });
  it("preserves legacy event context without offering activity fields in the asset editor", async () => {
    mocks.edit.mockResolvedValue(undefined);
    const asset = {
      ...prototypeAssets[0],
      details: {
        ownerName: "",
        ownerEmail: "",
        picEmail: "",
        eventName: "Legacy event",
        setupName: "Skybridge",
        reference: "legacy-ref",
        composition: "Whole" as const,
        compositionNotes: "Whole booth",
        confirmedDate: "2025-01-01",
        dateMeaning: "Received" as const,
      },
    };
    render(<AssetEditor asset={asset} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit asset" }));
    expect(screen.queryByLabelText("Record ini mewakili")).toBeNull();
    expect(screen.queryByLabelText("Nama event")).toBeNull();
    expect(screen.queryByLabelText("Nama setup / zona")).toBeNull();
    expect(
      screen.queryByLabelText("Tanggal dari sumber yang sudah dipastikan"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    await waitFor(() => expect(mocks.edit).toHaveBeenCalledTimes(1));
    expect(mocks.edit.mock.calls[0][1].details).toEqual(asset.details);
  });
});
