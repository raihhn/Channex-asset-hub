import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { PrototypeProvider, usePrototype } from "@/features/prototype/prototype-provider";
import { activeReviewAssignment } from "@/lib/domain/approvals";
import { blocksAssetAvailability } from "@/lib/domain/reservations";
import type { RequestDraft } from "@/types/prototype";

const wrapper = ({ children }: { children: ReactNode }) => <PrototypeProvider>{children}</PrototypeProvider>;
const draft: RequestDraft = { startDate: "2026-11-12", endDate: "2026-11-14", destination: "Test venue", purpose: "Review test", contact: "Physical PIC", items: [{ assetId: "wardah-glow-pavilion", quantity: 1 }], wbsCodes: [] };

describe("manual Request review foundation", () => {
  it("submits without auto-routing, blocks self-review, and rejects inactive or Vendor reviewers", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    let requestId = "";
    act(() => { requestId = result.current.createRequest(draft).id; });
    const submitted = result.current.requests.find((item) => item.id === requestId)!;
    expect(submitted).toMatchObject({ status: "Pending approval", submittedByUserId: "dev-user", reviewRound: 1 });
    expect(result.current.approvalAssignments).toHaveLength(0);
    expect(result.current.auditEvents[0].action).toBe("REQUEST_SUBMITTED");
    expect(() => result.current.assignRequestReviewer(requestId, "dev-user")).toThrow(/own Request/);
    expect(() => result.current.assignRequestReviewer(requestId, "user-vendor")).toThrow(/active internal/);
    act(() => result.current.setPersonStatus("user-brand", "INACTIVE"));
    expect(() => result.current.assignRequestReviewer(requestId, "user-brand")).toThrow(/active internal/);
    act(() => result.current.assignRequestReviewer(requestId, "user-storedev"));
    expect(result.current.approvalAssignments[0]).toMatchObject({ requestId, reviewerUserId: "user-storedev", assignedByUserId: "dev-user", status: "Pending", cycle: 1, sequence: 1 });
    expect(result.current.auditEvents[0]).toMatchObject({ action: "REVIEWER_ASSIGNED", actorUserId: "dev-user" });
  });

  it("supersedes reassigned reviewer, rejects non-assignee decisions, and preserves history", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    const requestId = "REQ-2026-022";
    act(() => result.current.assignRequestReviewer(requestId, "user-storedev"));
    const firstId = result.current.approvalAssignments[0].id;
    act(() => result.current.assignRequestReviewer(requestId, "user-brand"));
    expect(result.current.approvalAssignments.find((item) => item.id === firstId)?.status).toBe("Superseded");
    expect(activeReviewAssignment(result.current.approvalAssignments, requestId)?.reviewerUserId).toBe("user-brand");
    expect(result.current.requests.find((item) => item.id === requestId)?.reviewHistory?.map((event) => event.action)).toEqual(["Assigned", "Reassigned"]);
    expect(result.current.auditEvents[0].action).toBe("REVIEWER_REASSIGNED");
    expect(() => result.current.decideRequestReview(requestId, "Approved", "")).toThrow(/assigned reviewer/);
    act(() => result.current.setCurrentUserId("user-brand"));
    expect(() => result.current.decideRequestReview(requestId, "Rejected", "")).toThrow(/reason/);
    act(() => result.current.decideRequestReview(requestId, "Rejected", "Insufficient plan"));
    expect(result.current.requests.find((item) => item.id === requestId)?.status).toBe("Rejected");
    expect(result.current.approvalAssignments[0]).toMatchObject({ decision: "Rejected", decidedByUserId: "user-brand", note: "Insufficient plan" });
    expect(result.current.auditEvents[0]).toMatchObject({ action: "REVIEW_REJECTED", actorUserId: "user-brand" });
    expect(() => result.current.decideRequestReview(requestId, "Approved", "")).toThrow(/pending/);
  });

  it("keeps Needs Update distinct, revises the same Request, and starts a new manual cycle", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    let requestId = "";
    act(() => { requestId = result.current.createRequest(draft).id; });
    act(() => result.current.assignRequestReviewer(requestId, "user-storedev"));
    act(() => result.current.setCurrentUserId("user-storedev"));
    expect(() => result.current.decideRequestReview(requestId, "Needs update", "")).toThrow(/reason/);
    act(() => result.current.decideRequestReview(requestId, "Needs update", "Change destination"));
    expect(result.current.requests.find((item) => item.id === requestId)?.status).toBe("Needs update");
    const previousAssignmentId = result.current.approvalAssignments[0].id;
    expect(() => result.current.resubmitRequest(requestId, { ...draft, destination: "Revised venue" })).toThrow(/requester/);
    act(() => result.current.setCurrentUserId("dev-user"));
    act(() => result.current.resubmitRequest(requestId, { ...draft, destination: "Revised venue" }));
    const revised = result.current.requests.find((item) => item.id === requestId)!;
    expect(revised).toMatchObject({ id: requestId, status: "Pending approval", reviewRound: 2, destination: "Revised venue" });
    expect(revised.items[0].id).toBe(`${requestId}:item:1`);
    expect(revised.reviewHistory?.map((event) => event.action)).toEqual(["Submitted", "Assigned", "Needs update", "Resubmitted"]);
    expect(result.current.approvalAssignments.find((item) => item.id === previousAssignmentId)?.status).toBe("Needs update");
    expect(activeReviewAssignment(result.current.approvalAssignments, requestId)).toBeUndefined();
    expect(result.current.auditEvents[0]).toMatchObject({ action: "REQUEST_RESUBMITTED", actorUserId: "dev-user" });
    act(() => result.current.assignRequestReviewer(requestId, "user-storedev"));
    expect(result.current.approvalAssignments[0].cycle).toBe(2);
    act(() => result.current.setCurrentUserId("user-storedev"));
    act(() => result.current.decideRequestReview(requestId, "Approved", ""));
    expect(result.current.requests.find((item) => item.id === requestId)?.status).toBe("Approved");
    expect(result.current.auditEvents[0].action).toBe("REVIEW_APPROVED");
    expect(() => result.current.resubmitRequest(requestId, draft)).toThrow(/needing an update/);
  });

  it("retains centralized reservation semantics across review outcomes", () => {
    expect(blocksAssetAvailability("Pending approval")).toBe(true);
    expect(blocksAssetAvailability("Needs update")).toBe(true);
    expect(blocksAssetAvailability("Approved")).toBe(true);
    expect(blocksAssetAvailability("Rejected")).toBe(false);
    expect(blocksAssetAvailability("Cancelled")).toBe(false);
  });
});
