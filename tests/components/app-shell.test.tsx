import { render, screen } from "@testing-library/react";

import { AppShell } from "@/components/shared/app-shell";

describe("AppShell", () => {
  it("provides distinct mobile and desktop navigation foundations", () => {
    render(
      <AppShell workspaceName="Development workspace">
        <p>Foundation content</p>
      </AppShell>,
    );

    expect(screen.getByLabelText("Desktop navigation")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Mobile primary navigation"),
    ).toBeInTheDocument();
    expect(screen.getByText("Foundation content")).toBeInTheDocument();
  });
});
