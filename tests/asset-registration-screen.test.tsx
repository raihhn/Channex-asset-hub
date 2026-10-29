import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AddAssetScreen } from "@/features/assets/add-asset-screen";
import { AssetCommandError } from "@/lib/asset-registration-client";
const mocks = vi.hoisted(() => ({ register: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/prototype/prototype-provider", () => ({
  usePrototype: () => ({
    currentUser: { id: "dev-user", roles: ["STORE_DEV"] },
    registerAsset: mocks.register,
  }),
}));
vi.mock("@/components/shared/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/components/shared/hero-select", () => ({
  HeroSelect: ({
    label,
    value,
    onChange,
    options,
    isDisabled,
  }: {
    label: string;
    value: string;
    onChange: (s: string) => void;
    options: { value: string; label: string }[];
    isDisabled?: boolean;
  }) => (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isDisabled}
      >
        <option value="">Select</option>
        {options.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));
vi.mock("@/features/assets/asset-contact-picker", () => ({
  AssetContactPicker: ({
    onChange,
    label,
  }: {
    onChange: (ids: string[]) => void;
    label?: string;
  }) => (
    <button
      type="button"
      onClick={() => onChange(["11111111-1111-4111-8111-111111111111"])}
    >
      {label ? "Select Owner" : "Select PIC"}
    </button>
  ),
}));
vi.mock("@/lib/actor-client", async (original) => ({
  ...(await original<typeof import("@/lib/actor-client")>()),
  readLocalApi: async (path: string) =>
    path.includes("groups")
      ? []
      : [
          {
            id: "internal-1",
            name: "Internal fixture",
            type: "Internal warehouse",
            address: "",
          },
        ],
}));
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: () => "blob:preview",
      revokeObjectURL: () => {},
    }),
  );
});
async function review(withPhoto = true) {
  render(<AddAssetScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Continue", exact: true }),
    ).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText("Asset name"), {
    target: { value: "Draft retained asset" },
  });
  fireEvent.change(screen.getByLabelText("Warehouse location"), {
    target: { value: "internal-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Select Owner" }));
  fireEvent.click(screen.getByRole("button", { name: "Select PIC" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Continue", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Continue", exact: true }),
  );
  if (withPhoto)
    fireEvent.change(screen.getByLabelText("Choose asset photos"), {
      target: {
        files: [
          new File(["client-only preview fixture"], "a.png", {
            type: "image/png",
          }),
        ],
      },
    });
  fireEvent.click(
    screen.getByRole("button", { name: "Continue", exact: true }),
  );
}
describe("four-stage registration recovery (mocked transport, no DB)", () => {
  it("does not submit or advance review without an actual selected primary file", async () => {
    await review(false);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "real primary Asset Photo",
    );
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("freezes draft/key after uncertain network outcome, retries same command and navigates only on success", async () => {
    mocks.register
      .mockRejectedValueOnce(Error("Response lost"))
      .mockResolvedValueOnce({ id: "asset-saved" });
    await review();
    fireEvent.click(
      screen.getByRole("button", { name: "Register asset", exact: true }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Response lost");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Back", exact: true }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry same registration" }),
    );
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/assets/asset-saved"),
    );
    expect(mocks.register.mock.calls[0][0]).toEqual(
      mocks.register.mock.calls[1][0],
    );
    expect(mocks.register.mock.calls[0][1][0].file).toBe(
      mocks.register.mock.calls[1][1][0].file,
    );
  });
  it("keeps values and allows corrections after definitive validation failure", async () => {
    mocks.register.mockRejectedValueOnce(
      new AssetCommandError(400, "VALIDATION", "PIC is no longer active"),
    );
    await review();
    fireEvent.click(
      screen.getByRole("button", { name: "Register asset", exact: true }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PIC is no longer active",
    );
    expect(
      screen.getByRole("button", { name: "Back", exact: true }),
    ).not.toBeDisabled();
    expect(screen.getByText("Draft retained asset")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
