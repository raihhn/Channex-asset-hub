"use client";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { readLocalApi, localIdentityMessage } from "@/lib/actor-client";
type Event = {
  id: string;
  date: string;
  title: string;
  detail: string;
  kind?: string;
  source?: string;
  actorId?: string;
  evidence?: Array<{ url: string; label: string }>;
};
export function AssetHistory({
  assetId,
  revision,
}: {
  assetId: string;
  revision?: string;
}) {
  const [events, setEvents] = useState<Event[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [filter, setFilter] = useState("All");
  useEffect(() => {
    let active = true;
    readLocalApi<Event[]>(`/api/assets/${encodeURIComponent(assetId)}/history`)
      .then((list) => {
        if (active) {
          setEvents(list);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assetId, revision]);
  return (
    <section className="mb-6 grid min-w-0 gap-4" aria-label="Asset History">
      <h2>Asset History</h2>
      <p className="text-muted text-sm">
        Source references, durable corrections and operational evidence are
        distinguished. Missing inspection or usage evidence is not inferred.
      </p>
      <div
        role="group"
        aria-label="History filters"
        className="flex flex-wrap gap-2"
      >
        {[
          "All",
          "Registration",
          "Metadata",
          "Documentation",
          "Correction",
          "Import",
          "Usage",
          "Movement",
          "Condition",
          "Issues",
          "Maintenance",
        ].map((kind) => (
          <Button
            key={kind}
            size="sm"
            variant={filter === kind ? "primary" : "tertiary"}
            onPress={() => setFilter(kind)}
          >
            {kind}
          </Button>
        ))}
      </div>
      {loading ? (
        <p role="status">Loading asset history…</p>
      ) : error ? (
        <p role="alert">{localIdentityMessage(error)}</p>
      ) : (
        <ol className="grid min-w-0 gap-3">
          {events
            .filter((e) => filter === "All" || e.kind === filter)
            .map((e) => (
              <li
                key={e.id}
                className="border-border grid min-w-0 gap-2 rounded-xl border p-4"
              >
                <p className="text-muted text-sm">
                  {Number.isFinite(Date.parse(e.date))
                    ? new Date(e.date).toLocaleString("id-ID", {
                        timeZone: "Asia/Jakarta",
                      })
                    : `${e.date || "Date unknown"} (source)`}{" "}
                  · {e.source ?? "source"} · {e.kind ?? "Unclassified"}
                </p>
                <h3 className="font-semibold">{e.title}</h3>
                <p className="text-sm [overflow-wrap:anywhere]">{e.detail}</p>
                {e.actorId && (
                  <p className="text-muted text-sm">Recorded by {e.actorId}</p>
                )}
                {e.evidence?.map((photo, i) => (
                  <a
                    key={i}
                    className="text-accent text-sm underline"
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {photo.label}
                  </a>
                ))}
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
