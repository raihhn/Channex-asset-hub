"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@heroui/react";

import { AssetGallery } from "@/components/domain/asset-gallery";
import { AssetClassification } from "@/components/domain/asset-classification";
import { AssetIssueSummary } from "@/components/domain/asset-issue-summary";
import { AssetStatus } from "@/components/domain/asset-status";
import { DocumentationChecklist } from "@/components/domain/documentation-checklist";
import { AppShell } from "@/components/shared/app-shell";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { isOperationallySelectable } from "@/lib/fixtures/request-eligibility";
import { isDisposalReviewRecommended } from "@/lib/domain/asset-governance";
import { deriveReservations } from "@/lib/domain/reservations";
import { activeMaintenanceForAsset } from "@/lib/domain/maintenance";

export function AssetDetailScreen({ assetId }: { assetId: string }) {
  const { assets, events, requests, returnReceipts, maintenanceRecords } = usePrototype();
  const asset = assets.find((item) => item.id === assetId);
  const [historyFilter, setHistoryFilter] = useState("All");
  if (!asset) return null;
  const latestReceipt = returnReceipts
    .filter((receipt) => receipt.assetId === asset.id && receipt.receivedAt)
    .sort((first, second) =>
      second.receivedAt!.localeCompare(first.receivedAt!),
    )[0];
  const now = new Date();
  const localNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const upcomingReservations = deriveReservations(
    requests,
    assets,
    events,
    returnReceipts,
  )
    .filter(
      (reservation) =>
        reservation.assetId === asset.id &&
        reservation.blocksAvailability &&
        !reservation.actualInboundAt &&
        (reservation.inboundAt >= localNow || reservation.blocksAvailability),
    )
    .sort((first, second) => first.outboundAt.localeCompare(second.outboundAt));
  const completedWithoutReceipt = upcomingReservations.find(
    (reservation) => reservation.requestStatus === "Completed",
  );
  const requestable =
    isOperationallySelectable(asset) && !completedWithoutReceipt;
  const activeMaintenance = activeMaintenanceForAsset(maintenanceRecords, asset.id);
  const maintenanceHistory = maintenanceRecords.filter((record) => record.assetId === asset.id);
  return (
    <AppShell pageLabel="Asset detail">
      <div className="asset-detail-screen">
        <Link className="back-link" href="/assets">
          ← All assets
        </Link>
        <div className="asset-detail-layout">
          <div className="asset-detail-artwork">
            <AssetGallery asset={asset} />
          </div>
          <div className="asset-detail-summary">
            <p>
              {asset.brand} · {asset.code}
            </p>
            <h1>{asset.name}</h1>
            <span className="asset-detail-summary__type">{asset.type}</span>
            <AssetClassification asset={asset} />
            {isDisposalReviewRecommended(asset) ? (
              <span className="lifecycle-flag">
                Disposal review recommended
              </span>
            ) : null}
            <div className="asset-detail-summary__status">
              {completedWithoutReceipt ? (
                <span className="lifecycle-flag">Receipt unconfirmed</span>
              ) : (
                <AssetStatus status={asset.availability} />
              )}
              {asset.lifecycleNote ? (
                <span className="lifecycle-flag">{asset.lifecycleNote}</span>
              ) : null}
              {completedWithoutReceipt ? (
                <span className="lifecycle-flag">
                  Receipt evidence unavailable ·{" "}
                  {completedWithoutReceipt.requestId}
                </span>
              ) : null}
            </div>
            <p className="asset-detail-summary__description">
              {asset.description}
            </p>
          </div>
        </div>
        <section className="asset-facts" aria-label="Asset operational details">
          <Fact
            label="Current location"
            value={asset.location}
            note={asset.locationType}
          />
          <Fact
            label="Current custodian"
            value={asset.currentCustodian ?? "Not recorded"}
            note="Updated only after physical receipt"
          />
          {latestReceipt?.receivedAt ? (
            <Fact
              label="Actual inbound"
              value={new Date(latestReceipt.receivedAt).toLocaleString(
                "en-GB",
                {
                  dateStyle: "medium",
                  timeStyle: "short",
                },
              )}
              note={`Condition: ${latestReceipt.conditionAtReceipt} · ${latestReceipt.receivedBy}`}
            />
          ) : null}
          <Fact
            label="Asset age"
            value={asset.ageLabel}
            note={`Produced ${asset.producedAt}`}
          />
          <Fact
            label="Condition"
            value={asset.condition}
            note={
              asset.condition === "Good"
                ? "Ready for operational use"
                : "Confirm before dispatch"
            }
          />
          <Fact
            label="Lifecycle / review"
            value={asset.lifecycleNote ? "Review attention" : "Operational"}
            note={asset.lifecycleNote ?? "No review currently due"}
          />
          <Fact
            label="Last used"
            value={asset.lastUsed}
            note={asset.lastUsedContext}
          />
        </section>
        <AssetIssueSummary asset={asset} />
        <section className="asset-health" aria-label="Maintenance records">
          <div><p>Asset operations</p><h2>Maintenance</h2></div>
          {activeMaintenance ? <p><strong>Active: {activeMaintenance.status}</strong> · <Link href={`/maintenance/${activeMaintenance.id}`}>Open {activeMaintenance.id} →</Link></p> : <Link href={`/maintenance/new?assetId=${asset.id}`}>Create maintenance →</Link>}
          {!activeMaintenance && asset.issues.filter((issue) => issue.status !== "Resolved").length ? <div className="space-y-1">{asset.issues.filter((issue) => issue.status !== "Resolved").map((issue) => <p key={issue.id}><Link href={`/maintenance/new?assetId=${asset.id}&issueId=${issue.id}`}>Create maintenance from {issue.type} issue →</Link></p>)}</div> : null}
          {maintenanceHistory.length ? <ul>{maintenanceHistory.map((record) => <li key={record.id}><Link href={`/maintenance/${record.id}`}>{record.id}</Link> · {record.status} · {record.reason}</li>)}</ul> : <p>No maintenance records in this session.</p>}
        </section>
        <section className="asset-health" aria-label="Asset schedule">
          <div>
            <p>Schedule</p>
            <h2>Near-future usage</h2>
          </div>
          <ol className="request-timeline">
            <li className="is-complete">
              <span />
              <div>
                <strong>Today · {asset.location}</strong>
                <small>Current confirmed location</small>
              </div>
            </li>
            {upcomingReservations.slice(0, 4).map((reservation) => (
              <li key={reservation.id} className="is-current">
                <span />
                <div>
                  <strong>{reservation.activityName}</strong>
                  <small>
                    Planned outbound{" "}
                    {reservation.outboundAt.replace("T", " · ")} · Scheduled
                    usage {reservation.usageStartAt.slice(0, 10)}–
                    {reservation.usageEndAt.slice(0, 10)} · Expected return{" "}
                    {reservation.inboundAt.replace("T", " · ")}
                  </small>
                  <small>
                    {reservation.assetBrand} · {reservation.destination} ·{" "}
                    {reservation.requestId} · Planned
                  </small>
                  <Link href={`/requests/${reservation.requestId}`}>
                    View request
                  </Link>
                </div>
              </li>
            ))}
            {!upcomingReservations.length
              ? (asset.blockedRanges ?? []).map((range) => (
                  <li
                    key={`${range.start}-${range.end}`}
                    className="is-current"
                  >
                    <span />
                    <div>
                      <strong>
                        {range.start} — {range.end}
                      </strong>
                      <small>{range.label} · Reserved (fixture schedule)</small>
                    </div>
                  </li>
                ))
              : null}
            {asset.availability === "in-use" ? (
              <li className="is-current">
                <span />
                <div>
                  <strong>Current activation</strong>
                  <small>{asset.lastUsedContext} · In use</small>
                </div>
              </li>
            ) : null}
            {!asset.blockedRanges?.length && asset.availability !== "in-use" ? (
              <li>
                <span />
                <div>
                  <strong>No future booking in fixture</strong>
                  <small>Available to request for a compatible period</small>
                </div>
              </li>
            ) : null}
          </ol>
        </section>
        <section className="asset-health" aria-label="Asset health">
          <div>
            <p>Asset health</p>
            <h2>Operational readiness</h2>
          </div>
          <dl>
            <div>
              <dt>Condition</dt>
              <dd>{asset.condition}</dd>
            </div>
            <div>
              <dt>Open issues</dt>
              <dd>
                {
                  asset.issues.filter((issue) => issue.status !== "Resolved")
                    .length
                }
              </dd>
            </div>
            <div>
              <dt>Documentation</dt>
              <dd>
                {asset.photos.filter((photo) => photo.required).length} / 3
                required views
              </dd>
            </div>
            <div>
              <dt>Maintenance</dt>
              <dd>{asset.maintenance?.status ?? "Not in maintenance"}</dd>
            </div>
            <div>
              <dt>Inspection</dt>
              <dd>{asset.inspectionState ?? "Clear"}</dd>
            </div>
          </dl>
        </section>
        <DocumentationChecklist asset={asset} />
        <section className="detail-history">
          <div>
            <p>Operational context</p>
            <h2>Asset history</h2>
            <div
              className="history-filters"
              role="group"
              aria-label="Filter asset history"
            >
              {[
                "All",
                "Usage",
                "Movement",
                "Condition",
                "Issues",
                "Maintenance",
              ].map((kind) => (
                <Button
                  className={historyFilter === kind ? "is-active" : ""}
                  key={kind}
                  onClick={() => setHistoryFilter(kind)}
                  size="sm"
                  variant={historyFilter === kind ? "primary" : "ghost"}
                >
                  {kind}
                </Button>
              ))}
            </div>
          </div>
          <ol>
            {asset.history
              .filter(
                (entry) =>
                  historyFilter === "All" || entry.kind === historyFilter,
              )
              .map((entry) => (
                <li
                  className={entry.tone === "issue" ? "is-issue" : ""}
                  key={`${entry.date}-${entry.title}`}
                >
                  <span>{entry.date}</span>
                  <strong>{entry.title}</strong>
                  <small>{entry.detail}</small>
                </li>
              ))}
          </ol>
        </section>
        <div className="sticky-action">
          {requestable ? (
            <Link
              className="request-asset-button"
              href={`/request/${asset.id}`}
            >
              Request this asset <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <div className="not-requestable">
              <strong>Not requestable right now</strong>
              <span>
                {asset.availability === "maintenance"
                  ? "Maintenance needs to be resolved first."
                  : completedWithoutReceipt
                    ? "A completed request has no confirmed physical return receipt."
                    : "This asset is currently unavailable."}
              </span>
            </div>
          )}
        </div>
        <Link className="report-issue-link" href={`/assets/${asset.id}/issue`}>
          Report an issue
        </Link>
      </div>
    </AppShell>
  );
}

function Fact({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <small>{note}</small>
    </div>
  );
}
