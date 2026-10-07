import type { AuditAction, AuditChange, AuditEntityType, AuditEvent, Person } from "@/types/identity";

export function createAuditEvent(input: {
  actor: Person; action: AuditAction; entityType: AuditEntityType; entityId: string;
  summary: string; timestamp: string; changes?: AuditChange[];
  related?: AuditEvent["related"];
}): AuditEvent {
  if (!input.actor.id || !input.entityId || !input.summary.trim() || !Number.isFinite(Date.parse(input.timestamp)))
    throw new Error("Audit event requires actor, entity, summary, and timestamp.");
  return {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: input.timestamp,
    actorUserId: input.actor.id,
    actorNameSnapshot: input.actor.name,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary.trim(),
    ...(input.changes?.length ? { changes: input.changes.map((change) => ({ ...change })) } : {}),
    ...(input.related ? { related: { ...input.related } } : {}),
  };
}

export function appendAuditEvent(events: AuditEvent[], event: AuditEvent) {
  return [event, ...events];
}
