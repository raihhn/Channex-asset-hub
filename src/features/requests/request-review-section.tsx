"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Chip, TextArea, Disclosure } from "@heroui/react";

import { HeroSelect } from "@/components/shared/hero-select";
import { RequestStatus } from "@/components/domain/request-status";
import { usePrototype } from "@/features/prototype/prototype-provider";
import {
  activeReviewAssignment,
} from "@/lib/domain/approvals";
import { roleLabels, userHasRole } from "@/lib/domain/people";
import type { ApprovalDecision, PrototypeRequest } from "@/types/prototype";

export function RequestReviewSection({
  request,
  compact = false,
}: {
  request: PrototypeRequest;
  compact?: boolean;
}) {
  const {
    people, reviewerPeople,
    currentUser,
    approvalAssignments,
    assignRequestReviewer,
    decideRequestReview,
    savePersistedReview,
  } = usePrototype();
  const [reviewerId, setReviewerId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const active = activeReviewAssignment(approvalAssignments, request.id);
  const reviewer = (request.canonicalId ? reviewerPeople : people).find(
    (person) => person.id === active?.reviewerUserId,
  );
  const canAssign =
    userHasRole(currentUser, "SUPER_ADMIN") &&
    request.status === "Pending approval";
  const canDecide =
    request.status === "Pending approval" &&
    active?.reviewerUserId === currentUser.id;
  const options = (request.canonicalId ? reviewerPeople : people)
    .filter(
      (person) =>
        person.status === "ACTIVE" && !person.roles.includes("VENDOR") && person.id !== request.submittedByUserId,
    )
    .map((person) => ({
      value: person.id,
      label: `${person.name} · ${person.roles.map((role) => roleLabels[role]).join(", ")}`,
    }));
  const submitDecision = async (decision: ApprovalDecision) => {
    setSaving(true);
    try {
      if (request.canonicalId)
        await savePersistedReview(request, {
          action: "decide",
          decision,
          note,
        });
      else decideRequestReview(request.id, decision, note);
      setNote("");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not record this decision.",
      );
    } finally {
      setSaving(false);
    }
  };
  const submitAssignment = async () => {
    setSaving(true);
    try {
      if (request.canonicalId)
        await savePersistedReview(request, { action: "assign", reviewerId });
      else assignRequestReviewer(request.id, reviewerId);
      setReviewerId("");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not assign reviewer.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4 p-5" aria-label="Request review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">
            Request review · cycle {request.reviewRound ?? 1}
          </p>
          <h2 className="text-xl font-semibold">
            {compact
              ? canDecide
                ? "Review this request"
                : canAssign
                  ? "Assign a reviewer"
                  : request.status === "Needs update"
                    ? "Revision needed"
                    : "Approval status"
              : "Approval / Review"}
          </h2>
        </div>
        {!compact ? <RequestStatus status={request.status} /> : null}
      </div>
      <div className="border-border bg-background rounded-lg border p-4 text-sm">
        {request.status === "Pending approval" ? (
          active ? (
            <>
              <strong>Pending review</strong>
              <p>
                Reviewer: {reviewer?.name ?? active.reviewerUserId}
                {reviewer?.status === "INACTIVE"
                  ? " · inactive; reassignment required"
                  : ""}
              </p>
              <p className="text-muted-foreground">
                Assigned{" "}
                {new Date(active.assignedAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </>
          ) : (
            <>
              <strong>Reviewer assignment required</strong>
              <p className="text-muted-foreground">
                Submitted Request is waiting for a manual reviewer assignment.
              </p>
            </>
          )
        ) : request.status === "Needs update" ? (
          <>
            <strong>Revision required</strong>
            <p>
              {request.approvalComment ||
                "Review the feedback and update this Request."}
            </p>
            <Link
              className="text-primary mt-2 inline-block underline"
              href={`/request/new?revise=${encodeURIComponent(request.id)}`}
            >
              Edit and resubmit this Request →
            </Link>
          </>
        ) : (
          <>
            <strong>{request.status}</strong>
            {request.approvalComment ? <p>{request.approvalComment}</p> : null}
          </>
        )}
      </div>
      {canAssign ? (
        <div className="space-y-3">
          <HeroSelect
            label={active ? "Reassign reviewer" : "Assign reviewer"}
            placeholder="Choose an active internal Person"
            value={reviewerId}
            onChange={setReviewerId}
            options={options}
          />
          <Button
            variant="primary"
            isDisabled={!reviewerId || saving}
            onPress={submitAssignment}
          >
            {saving
              ? "Saving…"
              : active
                ? "Reassign reviewer"
                : "Assign reviewer"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Manual assignment only. Roles and scope are context, not routing
            rules.
          </p>
        </div>
      ) : null}
      {canDecide ? (
        <div className="space-y-3">
          <TextArea
            aria-label="Decision note"
            placeholder="Reason required for Reject or Needs Update; optional for Approve"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              isDisabled={saving}
              onPress={() => submitDecision("Approved")}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              isDisabled={saving}
              onPress={() => submitDecision("Needs update")}
            >
              Needs Update
            </Button>
            <Button
              variant="danger"
              isDisabled={saving}
              onPress={() => submitDecision("Rejected")}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : active && request.status === "Pending approval" ? (
        <p className="text-muted-foreground text-sm">
          Only {reviewer?.name ?? "the assigned reviewer"} can decide.{" "}
          <Link className="text-primary underline" href="/me">
            Switch prototype user
          </Link>{" "}
          in Me to review as that Person.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {compact ? (
        <Disclosure>
          <Disclosure.Heading>
            <Button slot="trigger" variant="ghost">
              Review history
              <Disclosure.Indicator />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body>
              {" "}
              <div className="border-border border-t pt-4">
                <h3 className="font-semibold">Review history</h3>
                {request.reviewHistory?.length ? (
                  <ol className="mt-3 space-y-3">
                    {request.reviewHistory.map((entry) => (
                      <li
                        className="border-border border-l-2 pl-3 text-sm"
                        key={entry.id}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{entry.action}</strong>
                          <Chip size="sm" variant="soft">
                            Cycle {entry.cycle}
                          </Chip>
                        </div>
                        <p className="text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}{" "}
                          · {entry.actorNameSnapshot}
                          {entry.reviewerUserId
                            ? ` · Reviewer ${(request.canonicalId ? reviewerPeople : people).find((person) => person.id === entry.reviewerUserId)?.name ?? entry.reviewerUserId}`
                            : ""}
                        </p>
                        {entry.note ? <p>{entry.note}</p> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted-foreground mt-2 text-sm">
                    Legacy fixture: {request.submittedAt}. Review actions will
                    appear here.
                  </p>
                )}
              </div>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      ) : (
        <div className="border-border border-t pt-4">
          <h3 className="font-semibold">Review history</h3>
          {request.reviewHistory?.length ? (
            <ol className="mt-3 space-y-3">
              {request.reviewHistory.map((entry) => (
                <li
                  className="border-border border-l-2 pl-3 text-sm"
                  key={entry.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{entry.action}</strong>
                    <Chip size="sm" variant="soft">
                      Cycle {entry.cycle}
                    </Chip>
                  </div>
                  <p className="text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {entry.actorNameSnapshot}
                    {entry.reviewerUserId
                      ? ` · Reviewer ${(request.canonicalId ? reviewerPeople : people).find((person) => person.id === entry.reviewerUserId)?.name ?? entry.reviewerUserId}`
                      : ""}
                  </p>
                  {entry.note ? <p>{entry.note}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              Legacy fixture: {request.submittedAt}. Review actions will appear
              here.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
