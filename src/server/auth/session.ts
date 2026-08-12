import { getDevelopmentSession } from "@/server/auth/dev-session";
import type { CurrentUser, Session } from "@/types/auth";

/**
 * The only session entry point application code should use. A production
 * provider will replace the adapter behind this contract in a later slice.
 */
export async function getCurrentSession(): Promise<Session | null> {
  return getDevelopmentSession();
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getCurrentSession())?.user ?? null;
}
