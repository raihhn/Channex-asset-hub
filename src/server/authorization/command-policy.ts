import "server-only";
import type { ServerActorContext } from "@/server/auth/actor-context";

/** Contracts only. Role/capability mappings and implementations require later slices. */
export type CommandName =
  | "asset.register"
  | "booking.submit"
  | "booking.resubmit"
  | "review.assign"
  | "review.decide"
  | "outbound.dispatch"
  | "outbound.receive"
  | "return.start"
  | "return.receive"
  | "transfer.execute"
  | "maintenance.manage"
  | "vendor.manage"
  | "people.manage"
  | "financial-reference.edit";
export type CommandPolicyResult =
  | { allowed: true }
  | { allowed: false; reason: "unresolved-policy" | "forbidden" };
export interface CommandPolicy<Resource> {
  authorize(
    actor: ServerActorContext,
    command: CommandName,
    resource: Resource,
  ): Promise<CommandPolicyResult>;
}
/** Unresolved commands must never become grants through role labels. */
export const unresolvedCommandPolicy: CommandPolicy<unknown> = {
  async authorize() {
    return { allowed: false, reason: "unresolved-policy" };
  },
};
