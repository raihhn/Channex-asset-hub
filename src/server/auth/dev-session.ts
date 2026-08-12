import type { Session } from "@/types/auth";

/**
 * Slice 0 only. This adapter keeps development usable while ensuring feature
 * code depends on the session contract rather than a future identity vendor.
 */
export function getDevelopmentSession(): Session | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return {
    source: "development",
    user: {
      id: "dev-user",
      displayName: "Development workspace",
      email: "dev@assethub.local",
      capabilities: ["asset:read", "request:create"],
    },
  };
}
