import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AssetContactPicker } from "@/features/assets/asset-contact-picker";
import type { AssetContact } from "@/lib/domain/asset-contacts";
const network = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/actor-client", async (original) => ({
  ...(await original<typeof import("@/lib/actor-client")>()),
  readLocalApi: network.read,
  actorFetch: network.write,
}));
const first = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "First Person",
  email: "first@example.com",
  phone: "123",
  active: true,
  source: "manual",
};
const second = {
  ...first,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Second Person",
  email: "second@example.com",
  phone: "456",
};
function Harness() {
  const [ids, setIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<AssetContact[]>([]);
  return (
    <>
      <AssetContactPicker
        value={ids}
        selectedContacts={contacts}
        onChange={(next, list) => {
          setIds(next);
          setContacts(list);
        }}
      />
      <output aria-label="Selected IDs">{ids.join(",")}</output>
    </>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  network.read.mockResolvedValue([first, second]);
});
afterEach(cleanup);
describe("shared asset contact picker", () => {
  it("selects by registered ID and fills channels without manual re-entry", async () => {
    render(<Harness />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Cari PIC internal/ }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Cari PIC internal/ }));
    fireEvent.click(
      await screen.findByRole("option", { name: /First Person/ }),
    );
    expect(screen.getByText("first@example.com")).toBeVisible();
    expect(screen.getByText("123")).toBeVisible();
    expect(screen.getByLabelText("Selected IDs")).toHaveTextContent(first.id);
    fireEvent.click(
      screen.getByRole("button", { name: "Lepas PIC First Person" }),
    );
    expect(screen.getByLabelText("Selected IDs")).toHaveTextContent("");
    expect(network.write).not.toHaveBeenCalled();
  });
  it("creates an explicit reusable contact and selects only the server-returned ID", async () => {
    network.write.mockResolvedValue(Response.json(second));
    render(<Harness />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Tambah kontak internal baru" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tambah kontak internal baru" }),
    );
    fireEvent.change(screen.getByLabelText("Nama kontak"), {
      target: { value: "Second Person" },
    });
    fireEvent.change(screen.getByLabelText("Email kontak"), {
      target: { value: "second@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Telepon kontak"), {
      target: { value: "456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Simpan kontak ke daftar" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Selected IDs")).toHaveTextContent(
        second.id,
      ),
    );
    expect(JSON.parse(network.write.mock.calls[0][1].body)).toEqual({
      name: "Second Person",
      email: "second@example.com",
      phone: "456",
    });
  });
  it("shows directory failures and never falls back to Person fixtures or manual actor headers", async () => {
    network.read.mockRejectedValue(Error("LOCAL_SESSION_REQUIRED"));
    render(<Harness />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Select a local identity",
    );
    expect(
      screen.getByRole("button", { name: /Cari PIC internal/ }),
    ).toBeDisabled();
    expect(screen.queryByText("Raihan Pradana")).toBeNull();
    expect(network.write).not.toHaveBeenCalled();
  });
});
