"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@heroui/react";

import { AppShell } from "@/components/shared/app-shell";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { deriveReservations } from "@/lib/domain/reservations";
import { OperationalCalendar } from "@/features/operations/operational-calendar";
import { activeReviewAssignment } from "@/lib/domain/approvals";

export function OperationsScreen() {
  const { assets, events, requests, returnReceipts, maintenanceRecords, approvalAssignments, people } = usePrototype();
  const reservations = deriveReservations(requests, assets, events, returnReceipts);
  const reviewRequests = requests.filter((request) => request.status === "Pending approval" || request.status === "Needs update");
  const groups = [
    ["Review due", assets.filter((asset) => asset.lifecycleNote)],
    [
      "Open issues",
      assets.filter((asset) =>
        asset.issues.some((issue) => issue.status !== "Resolved"),
      ),
    ],
    [
      "In maintenance",
      assets.filter((asset) => asset.maintenance?.status !== "Completed"),
    ],
    [
      "Missing documentation",
      assets.filter((asset) =>
        ["Front", "Left side", "Right side"].some(
          (view) => !asset.photos.some((photo) => photo.view === view),
        ),
      ),
    ],
  ] as const;
  return (
    <AppShell pageLabel="Asset operations">
      <div className="operations-screen">
        <section className="screen-intro">
          <p>Asset Ops</p>
          <h1>Operational queue</h1>
          <span>
            Work through asset health, maintenance, documentation, and return
            readiness.
          </span>
        </section>
        <OperationalCalendar reservations={reservations} />
        <section aria-label="Request review queue">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Request reviews</h2>
              <span className="text-sm font-semibold text-primary">{reviewRequests.length}</span>
            </div>
            {reviewRequests.length ? <ul className="grid gap-3 md:grid-cols-2">
              {reviewRequests.map((request) => {
                const assignment = activeReviewAssignment(approvalAssignments, request.id);
                return <li className="rounded-lg border border-border p-4" key={request.id}>
                  <Link className="font-semibold text-primary" href={`/requests/${request.id}`}>{request.projectName ?? request.purpose}</Link>
                  <p className="mt-1 text-sm text-muted-foreground">{request.status === "Needs update" ? "Needs Update · waiting for revision" : assignment ? `Pending review · ${people.find((person) => person.id === assignment.reviewerUserId)?.name ?? assignment.reviewerUserId}` : "Reviewer assignment required"}</p>
                </li>;
              })}
            </ul> : <p className="text-sm text-muted-foreground">No Requests waiting for review or revision.</p>}
          </Card>
        </section>
        <section className="operations-queue" aria-label="Maintenance queue"><h2>Maintenance records <span>{maintenanceRecords.length}</span></h2>
          {maintenanceRecords.length ? <ul>{maintenanceRecords.map((record) => {
            const asset = assets.find((item) => item.id === record.assetId);
            return <li key={record.id}><Link href={`/maintenance/${record.id}`}>{asset?.name ?? record.assetId}</Link><small>{record.status} · {record.reason}</small></li>;
          })}</ul> : <p>No maintenance records in this session.</p>}
          <Link href="/maintenance/new">Create maintenance →</Link>
        </section>
        <div className="operations-actions">
          <Link
            aria-label="Add asset"
            className="button-primary operations-add-asset"
            href="/assets/new"
          >
            <Plus aria-hidden="true" size={18} />
            <span className="sr-only">Add asset</span>
          </Link>
          <Link href="/request/new?assets=wardah-glow-pavilion,wardah-curved-counter,wardah-lighting-kit">
            Use Wardah Colorfit 6×6 setup
          </Link>
        </div>
        <p className="setup-note">
          <strong>Wardah Colorfit 6×6 Setup</strong> · Suggests independently
          tracked pavilion, white curved counter, and lighting kit. Items remain
          editable before request.
        </p>
        <div className="operations-queue">
          {groups.map(([title, group]) => (
            <section key={title}>
              <h2>
                {title}
                <span>{group.length}</span>
              </h2>
              {group.length ? (
                <ul>
                  {group.map((asset) => (
                    <li key={asset.id}>
                      <Link href={`/assets/${asset.id}`}>{asset.name}</Link>
                      <small>
                        {asset.maintenance?.reason ??
                          asset.lifecycleNote ??
                          `${asset.issues.length} issue(s)`}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nothing needs attention.</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
