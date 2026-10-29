import { describe, expect, it } from "vitest";
import {
  requestJourney,
  deriveReturnTasks,
} from "@/lib/domain/request-journey";
import { dispatchOutbound, receiveOutbound } from "@/lib/domain/outbound";
import {
  prototypeAssets,
  prototypeRequests,
} from "@/lib/fixtures/prototype-data";
import { peopleFixtures } from "@/lib/fixtures/people";
import type { ReturnReceipt } from "@/types/prototype";
const request = prototypeRequests.find(
  (request) => request.id === "REQ-2026-014",
)!;
const actor = peopleFixtures[0];
const packet = dispatchOutbound([], request, prototypeAssets, [], actor, {
  id: "shipment",
  groupId: "outbound-default",
  itemIds: request.items.map((item) => item.id),
  senderPic: "Sender",
  loadingInLetters: [
    {
      id: "letter",
      category: "Loading-in letter",
      name: "in.pdf",
      mimeType: "application/pdf",
      size: 10,
      dataUrl: "data:application/pdf;base64,JVBERg==",
    },
  ],
  at: "2026-08-22T08:00:00+07:00",
});
const received = receiveOutbound(packet, actor, {
  itemIds: request.items.map((item) => item.id),
  receiverPic: "Receiver",
  condition: "Good",
  at: "2026-08-22T10:00:00+07:00",
});
const now = "2026-08-23T12:00";
describe("booking journey and automatic return tasks", () => {
  it("approval and dates alone never create shipment or return tasks", () => {
    expect(deriveReturnTasks(request, [], [], "2027-01-01T12:00")).toEqual([]);
    expect(requestJourney(request, [], [], now).label).toBe(
      "Preparing delivery",
    );
    expect(
      requestJourney({ ...request, status: "Pending approval" }, [], [], now)
        .filter,
    ).toBe("approval");
  });
  it("creates stable per-item tasks at dispatch but blocks return before arrival", () => {
    const tasks = deriveReturnTasks(request, [packet], [], now);
    expect(tasks).toHaveLength(2);
    expect(
      tasks.every(
        (task) => task.state === "Awaiting delivery" && !task.canStart,
      ),
    ).toBe(true);
    expect(
      deriveReturnTasks(request, [packet], [], "2027-01-01T12:00").every(
        (task) => !task.overdue,
      ),
    ).toBe(true);
  });
  it("follows partial arrival independently and derives due day then overdue", () => {
    const partial = receiveOutbound(packet, actor, {
      itemIds: [request.items[0].id],
      receiverPic: "Receiver",
      condition: "Good",
      at: "2026-08-22T10:00:00+07:00",
    });
    const tasks = deriveReturnTasks(
      { ...request, status: "In use" },
      [partial],
      [],
      "2026-08-24T10:00",
    );
    expect(tasks[0].state).toBe("Due today");
    expect(tasks[1].state).toBe("Awaiting delivery");
    expect(
      requestJourney({ ...request, status: "In use" }, [partial], [], now)
        .needsDelivery,
    ).toBe(true);
    expect(
      deriveReturnTasks(request, [received], [], "2026-08-25T00:00")[0].state,
    ).toBe("Overdue");
  });
  it("keeps overdue reminders after starting return and excludes received siblings", () => {
    const receipts: ReturnReceipt[] = [
      {
        id: "return",
        requestId: request.id,
        requestItemId: request.items[0].id,
        assetId: request.items[0].assetId,
        initiatedAt: "2026-08-24T10:00:00+07:00",
        initiatedBy: "Holder",
      },
    ];
    let tasks = deriveReturnTasks(
      request,
      [received],
      receipts,
      "2026-08-25T00:00",
    );
    expect(tasks[0].state).toBe("Return in progress");
    expect(tasks[0].overdue).toBe(true);
    tasks = deriveReturnTasks(
      request,
      [received],
      [{ ...receipts[0], receivedAt: "2026-08-24T15:00:00+07:00" }],
      "2026-08-25T00:00",
    );
    expect(tasks[0].state).toBe("Inspection pending");
    expect(tasks[0].overdue).toBe(false);
    expect(tasks[1].overdue).toBe(true);
  });
  it("requires every receipt and clear inspection before closing, including holds", () => {
    const receipts: ReturnReceipt[] = request.items.map((item) => ({
      id: `return:${item.id}`,
      requestId: request.id,
      requestItemId: item.id,
      assetId: item.assetId,
      initiatedBy: "Holder",
      initiatedAt: "2026-08-24T10:00:00+07:00",
      receivedAt: "2026-08-24T15:00:00+07:00",
      inspectionOutcome: "Clear",
      inspectedAt: "2026-08-24T17:00:00+07:00",
    }));
    expect(requestJourney(request, [received], receipts, now).complete).toBe(
      true,
    );
    expect(
      requestJourney(
        request,
        [received],
        [{ ...receipts[0], inspectionOutcome: "On hold" }, receipts[1]],
        now,
      ).closed,
    ).toBe(false);
    expect(requestJourney(request, [received], [receipts[0]], now).closed).toBe(
      false,
    );
  });
  it("does not treat legacy Completed as physical return and skips nonphysical tasks", () => {
    const legacy = requestJourney(
      { ...request, status: "Completed" },
      [],
      [],
      "2027-01-01T00:00",
    );
    expect(legacy.closed).toBe(false);
    expect(legacy.tasks.every((task) => task.historical)).toBe(true);
    expect(legacy.steps[2].state).not.toBe("complete");
    expect(deriveReturnTasks({ ...request, items: [] }, [], [], now)).toEqual(
      [],
    );
  });
});
