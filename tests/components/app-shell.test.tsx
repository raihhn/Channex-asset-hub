import { render, screen } from "@testing-library/react";

import { AppShell } from "@/components/shared/app-shell";
import { PrototypeProvider } from "@/features/prototype/prototype-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe("AppShell", () => {
  it("provides distinct mobile and desktop navigation foundations", () => {
    render(
      <PrototypeProvider><AppShell pageLabel="Raihan Pradana">
        <p>Foundation content</p>
      </AppShell></PrototypeProvider>,
    );

    expect(screen.getByLabelText("Desktop navigation")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Mobile primary navigation"),
    ).toBeInTheDocument();
    expect(screen.getByText("Foundation content")).toBeInTheDocument();
  });
});
