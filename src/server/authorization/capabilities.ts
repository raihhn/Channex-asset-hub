import { getCurrentSession } from "@/server/auth/session";
import type { Capability, Session } from "@/types/auth";

export function sessionHasCapability(
  session: Session | null,
  capability: Capability,
) {
  return session?.user.capabilities.includes(capability) ?? false;
}

/**
 * Future server mutations should call this boundary, not inspect role labels
 * or navigation visibility. Scope-aware policy can be added behind it.
 */
export async function hasCapability(capability: Capability) {
  return sessionHasCapability(await getCurrentSession(), capability);
}
