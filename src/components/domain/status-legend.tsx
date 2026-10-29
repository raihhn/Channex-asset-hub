const statusFoundations = [
  { label: "Available", tone: "available" },
  { label: "Reserved", tone: "reserved" },
  { label: "In use", tone: "in-use" },
  { label: "Review due", tone: "review" },
  { label: "Unavailable", tone: "unavailable" },
] as const;

/** Token verification only; it is not an operational asset status component. */
export function StatusLegend() {
  return (
    <ul aria-label="Status token foundation" className="flex flex-wrap gap-2">
      {statusFoundations.map((status) => (
        <li
          className={`status-token status-token--${status.tone}`}
          key={status.tone}
        >
          <span aria-hidden="true" className="status-token__dot" />
          {status.label}
        </li>
      ))}
    </ul>
  );
}
