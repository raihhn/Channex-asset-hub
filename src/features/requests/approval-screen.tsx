"use client";

import Link from "next/link";
import { Card } from "@heroui/react";

import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { RequestStatus } from "@/components/domain/request-status";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { activeReviewAssignment } from "@/lib/domain/approvals";

export function ApprovalScreen() {
  const { requests, approvalAssignments, people } = usePrototype();
  const pending = requests.filter(
    (request) => request.status === "Pending approval",
  );
  return (
    <AppShell pageLabel="Approval queue">
      <div className="approval-screen">
        <section className="screen-intro">
          <p>Authorized prototype view</p>
          <h1>Approval queue</h1>
          <span>
            Review booking context and record a fixture-only decision.
          </span>
        </section>
        {pending.length ? (
          <div className="approval-list">
            {pending.map((request) => {
              const assignment = activeReviewAssignment(approvalAssignments, request.id);
              return (
                <Card className="approval-card" key={request.id}>
                  <div className="approval-card__heading">
                    <div>
                      <p>{request.id}</p>
                      <h2>{request.projectName ?? request.purpose}</h2>
                      <span>
                        {request.startDate} — {request.endDate} ·{" "}
                        {request.destination}
                      </span>
                    </div>
                    <RequestStatus status={request.status} />
                  </div>
                  <p>{assignment ? `Pending review · ${people.find((person) => person.id === assignment.reviewerUserId)?.name ?? assignment.reviewerUserId}` : "Reviewer assignment required"}</p>
                  <div className="approval-card__actions">
                    <Link href={`/requests/${request.id}`}>Open review →</Link>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Approval queue is clear"
            detail="Fixture decisions update this browser session only."
            actionHref="/requests"
            actionLabel="View requests"
          />
        )}
      </div>
    </AppShell>
  );
}
