import "server-only";
import type { Capability } from "@/types/auth";
import type { Person } from "@/types/identity";

/** An application actor is not an operational PIC or a provider's raw claims. */
export type ServerActorContext = Readonly<{
  identity: Readonly<{
    subject: string;
    source: "local-development" | "provider";
    providerVerified: boolean;
  }>;
  person: Readonly<Person>;
  capabilities: readonly Capability[];
}>;

export class ActorResolutionError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404 | 503,
    public readonly code: string,
  ) {
    super(code);
  }
}

/** Implementations must verify identity before explicit account-to-Person mapping. */
export interface ActorAdapter {
  resolve(request: Request): Promise<ServerActorContext>;
}
