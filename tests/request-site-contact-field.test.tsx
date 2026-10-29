import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { RequestSiteContactField } from "@/features/requests/request-site-contact-field";
import { peopleFixtures } from "@/lib/fixtures/people";
import type { Person, UserRole } from "@/types/identity";

const network = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/actor-client", async (original) => ({
  ...(await original<typeof import("@/lib/actor-client")>()),
  readLocalApi: network.read,
}));
const contact = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Site Person",
  email: "site@example.com",
  phone: "123",
  active: true,
  source: "manual",
};
function Harness({ actor }: { actor: Person }) {
  const [value, setValue] = useState("Existing vendor PIC");
  const [id, setId] = useState<string>();
  return (
    <>
      <RequestSiteContactField
        actor={actor}
        value={value}
        internalId={id}
        onChange={(text, nextId) => {
          setValue(text);
          setId(nextId);
        }}
      />
      <output aria-label="Contact ID">{id}</output>
    </>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  network.read.mockResolvedValue([contact]);
});
afterEach(cleanup);
describe("Request internal PIC visibility and manual compatibility", () => {
  it.each<UserRole>(["REQUESTER", "BRAND", "VENDOR", "MANAGEMENT"])(
    "keeps %s manual and never fetches the directory",
    (role) => {
      render(<Harness actor={{ ...peopleFixtures[0], roles: [role] }} />);
      expect(
        screen.queryByRole("button", { name: /Pilih PIC internal/ }),
      ).toBeNull();
      fireEvent.change(
        screen.getByLabelText("Project-site PIC (name and contact)"),
        { target: { value: "Manual name · phone" } },
      );
      expect(
        screen.getByLabelText("Project-site PIC (name and contact)"),
      ).toHaveValue("Manual name · phone");
      expect(network.read).not.toHaveBeenCalled();
    },
  );
  it.each<UserRole>(["STORE_DEV", "SUPER_ADMIN"])(
    "lets %s search/select by ID and explicitly return to manual input",
    async (role) => {
      render(<Harness actor={{ ...peopleFixtures[0], roles: [role] }} />);
      const selector = screen.getByRole("button", {
        name: /Pilih PIC internal/,
      });
      await waitFor(() => expect(selector).toBeEnabled());
      fireEvent.click(selector);
      fireEvent.click(
        await screen.findByRole("option", { name: /Site Person/ }),
      );
      expect(screen.getByLabelText("Contact ID")).toHaveTextContent(contact.id);
      expect(
        screen.getByLabelText("Project-site PIC (name and contact)"),
      ).toHaveValue("Site Person · 123 · site@example.com");
      expect(
        screen.getByLabelText("Project-site PIC (name and contact)"),
      ).toHaveAttribute("readonly");
      fireEvent.click(screen.getByRole("button", { name: "Isi PIC manual" }));
      expect(screen.getByLabelText("Contact ID")).toBeEmptyDOMElement();
      expect(
        screen.getByLabelText("Project-site PIC (name and contact)"),
      ).not.toHaveAttribute("readonly");
    },
  );
  it("shows an actionable session error while retaining the manual draft", async () => {
    network.read.mockRejectedValue(Error("LOCAL_SESSION_REQUIRED"));
    render(<Harness actor={peopleFixtures[0]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Select a local identity",
    );
    expect(
      screen.getByLabelText("Project-site PIC (name and contact)"),
    ).toHaveValue("Existing vendor PIC");
    expect(
      screen.getByRole("button", { name: /Pilih PIC internal/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Muat ulang kontak" }),
    ).toBeVisible();
  });
});
