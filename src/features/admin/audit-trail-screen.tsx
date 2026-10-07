"use client";

import { useMemo, useState } from "react";
import { Card, Chip } from "@heroui/react";

import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";

export function AuditTrailScreen() {
  const { auditEvents, people } = usePrototype();
  const [actor, setActor] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  // The provider prepends each event; filtering preserves deterministic insertion order even for same-millisecond actions.
  const visible = useMemo(() => auditEvents.filter((event) => (!actor || event.actorUserId === actor) && (!entityType || event.entityType === entityType) && (!action || event.action === action)), [auditEvents, actor, entityType, action]);
  const entities = [...new Set(auditEvents.map((event) => event.entityType))];
  const actions = [...new Set(auditEvents.map((event) => event.action))];
  return <div className="space-y-4"><Card className="grid gap-3 p-5 sm:grid-cols-3"><HeroSelect label="Actor" placeholder="All actors" value={actor} onChange={setActor} options={[{ label: "All actors", value: "" }, ...people.map((person) => ({ label: person.name, value: person.id }))]} /><HeroSelect label="Entity" placeholder="All entities" value={entityType} onChange={setEntityType} options={[{ label: "All entities", value: "" }, ...entities.map((value) => ({ label: value, value }))]} /><HeroSelect label="Action" placeholder="All actions" value={action} onChange={setAction} options={[{ label: "All actions", value: "" }, ...actions.map((value) => ({ label: value.replaceAll("_", " "), value }))]} /></Card>
    <p className="text-sm text-muted-foreground">{visible.length} events · newest first · session-only prototype audit</p>
    {visible.length ? <div className="space-y-3">{visible.map((event) => <Card className="p-4" key={event.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{event.summary}</strong><p className="text-sm text-muted-foreground">{event.actorNameSnapshot} · {new Date(event.timestamp).toLocaleString("en-GB")}</p></div><Chip size="sm" variant="soft">{event.action.replaceAll("_", " ")}</Chip></div><p className="mt-2 text-sm">{event.entityType} · {event.entityId}</p>{event.changes?.length || event.related ? <details className="mt-2 text-sm"><summary className="cursor-pointer text-primary">View details</summary>{event.changes?.map((change) => <p className="mt-1" key={change.field}>{change.field}: {change.before || "—"} → {change.after || "—"}</p>)}{event.related ? <p className="mt-1">Related: {[event.related.requestId, event.related.requestItemId, event.related.assetId].filter(Boolean).join(" · ")}</p> : null}</details> : null}</Card>)}</div> : <Card className="p-6"><strong>No audit events yet</strong><p>Make a change in People Master or an operational workflow to generate an event.</p></Card>}
  </div>;
}
