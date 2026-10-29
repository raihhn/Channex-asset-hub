import { render, screen } from "@testing-library/react";

import { StatusLegend } from "@/components/domain/status-legend";

describe("StatusLegend", () => {
  it("exposes every future operational status tone through a semantic label", () => {
    render(<StatusLegend />);

    expect(screen.getByLabelText("Status token foundation")).toHaveTextContent(
      "Available",
    );
    expect(screen.getByLabelText("Status token foundation")).toHaveTextContent(
      "Reserved",
    );
    expect(screen.getByLabelText("Status token foundation")).toHaveTextContent(
      "Review due",
    );
  });
});
