"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Button, Card, Chip, Table } from "@heroui/react";

import { AppShell } from "@/components/shared/app-shell";
import { administrationData } from "@/lib/fixtures/administration-data";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { getSubEvents } from "@/lib/domain/events";
import type { EventDraft } from "@/types/prototype";
import { PeopleMasterScreen } from "@/features/admin/people-master-screen";
import { AuditTrailScreen } from "@/features/admin/audit-trail-screen";
import { userHasRole } from "@/lib/domain/people";

export function AdminScreen({ section }: { section?: string }) {
  const { currentUser } = usePrototype();
  const isSuperAdmin = userHasRole(currentUser, "SUPER_ADMIN");
  const isPeopleSection = section === "users";
  const isAuditSection = section === "audit";
  const data = section ? administrationData[section] : undefined;
  return (
    <AppShell pageLabel={isPeopleSection ? "People" : isAuditSection ? "Audit Trail" : data?.title ?? "Administration"}>
      <div className="admin-screen">
        <section className="screen-intro admin-screen__intro">
          <p>{data?.eyebrow ?? "Administration"}</p>
          <h1>{isPeopleSection ? "People / Users" : isAuditSection ? "Audit Trail" : data?.title ?? "Master Data"}</h1>
          <span>
            {isPeopleSection ? "Configure prototype identity, roles, and organizational scope." : isAuditSection ? "Important changes across AssetHub, with actor and record context." : data
              ? "Review the operational reference data used across AssetHub."
              : "Manage the operational reference structure behind assets, requests, and approvals."}
          </span>
        </section>
        {isSuperAdmin ? <nav className="admin-screen__quick-nav mb-4 flex flex-wrap gap-3" aria-label="Administration tools"><Link className="rounded-lg border border-border bg-card px-4 py-2" href="/admin/users">People / Users</Link><Link className="rounded-lg border border-border bg-card px-4 py-2" href="/admin/audit">Audit Trail</Link></nav> : null}
        {(isPeopleSection || isAuditSection) && !isSuperAdmin ? <Card className="p-6"><strong>Global administration is not visible for this prototype user.</strong><p>Switch to the Super Admin fixture in Me to review People and Audit Trail. This is not production authorization.</p></Card> : isPeopleSection ? <PeopleMasterScreen /> : isAuditSection ? <AuditTrailScreen /> : !data ? <AdminDirectory isSuperAdmin={isSuperAdmin} /> : section === "events" ? <EventMasterData /> : <AdminTable data={data} />}
      </div>
    </AppShell>
  );
}

function EventMasterData() {
  const { events, saveEvent } = usePrototype();
  const [editingId, setEditingId] = useState<string>();
  const [error, setError] = useState("");
  const initial: EventDraft = {
    brand: "Wardah", campaign: "", name: "", venue: "", city: "", startDate: "2026-08-12", endDate: "2026-08-12", pic: "", status: "Planned", parentEventId: null,
  };
  const [form, setForm] = useState<EventDraft>(initial);
  const reset = () => { setEditingId(undefined); setError(""); setForm({ brand: "Wardah", campaign: "", name: "", venue: "", city: "", startDate: "2026-08-12", endDate: "2026-08-12", pic: "", status: "Planned", parentEventId: null }); };
  const parentOptions = useMemo(() => events.filter((event) => event.id !== editingId && !event.parentEventId), [editingId, events]);
  const field = (key: keyof EventDraft, label: string, type = "text") => <label className="event-master-field" key={String(key)}>{label}<input required={!["pic", "parentEventId"].includes(String(key))} type={type} value={String(form[key] ?? "")} onChange={(input) => { const value = input.currentTarget.value; setForm((currentForm) => ({ ...currentForm, [key]: value || (key === "parentEventId" ? null : "") })); }} /></label>;
  const save = (event: FormEvent) => { event.preventDefault(); const valid = saveEvent({ ...form, parentEventId: form.parentEventId || null }); if (!valid) { setError("That parent selection would create an invalid event hierarchy."); return; } reset(); };
  return <div className="admin-screen__event-data">
    <Card className="data-panel"><form className="event-master-form" onSubmit={save}>
      <div className="data-panel__bar"><strong>{editingId ? "Edit event" : "Add event"}</strong><div><Button onPress={reset} size="sm" variant="secondary" type="button">Clear</Button><Button size="sm" type="submit" variant="primary">Save event</Button></div></div>
      <div className="event-master-form__grid">{field("name", "Event name")}<label className="event-master-field">Brand<select value={form.brand} onChange={(input) => { const brand = input.currentTarget.value; setForm((item) => ({ ...item, brand })); }}>{administrationData.brands.rows.filter((brand) => brand.Status === "Active").map((brand) => <option key={brand.Code} value={brand.Name}>{brand.Name}</option>)}</select></label>{field("campaign", "Campaign")}{field("venue", "Venue")}{field("city", "City")}{field("startDate", "Start date", "date")}{field("endDate", "End date", "date")}{field("pic", "PIC")}
        <label className="event-master-field">Parent event<select value={form.parentEventId ?? ""} onChange={(input) => { const parentEventId = input.currentTarget.value || null; setForm((item) => ({ ...item, parentEventId })); }}><option value="">No parent (standalone or parent)</option>{parentOptions.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
        <label className="event-master-field">Status<select value={form.status} onChange={(input) => { const status = input.currentTarget.value as EventDraft["status"]; setForm((item) => ({ ...item, status })); }}><option>Planned</option><option>Active</option><option>Completed</option></select></label>
      </div>{error ? <p role="alert">{error}</p> : null}
    </form></Card>
    <Card className="data-panel"><div className="data-panel__bar"><strong>{events.length} events · hierarchy shown</strong></div><div className="data-table-wrap"><Table><Table.ScrollContainer><Table.Content aria-label="Event master data"><Table.Header><Table.Column isRowHeader>Event</Table.Column><Table.Column>Brand</Table.Column><Table.Column>Parent / children</Table.Column><Table.Column>Venue</Table.Column><Table.Column>Dates</Table.Column><Table.Column>Status</Table.Column><Table.Column aria-label="Actions" /></Table.Header><Table.Body>{events.map((event) => { const parent = events.find((candidate) => candidate.id === event.parentEventId); const children = getSubEvents(events, event.id); return <Table.Row id={event.id} key={event.id}><Table.Cell>{event.name}</Table.Cell><Table.Cell>{event.brand}</Table.Cell><Table.Cell>{parent ? `↳ ${parent.name}` : children.length ? `${children.length} sub-events: ${children.map((child) => child.name).join(", ")}` : "Standalone"}</Table.Cell><Table.Cell>{event.venue}, {event.city}</Table.Cell><Table.Cell>{event.startDate} – {event.endDate}</Table.Cell><Table.Cell><Chip size="sm" variant="soft">{event.status}</Chip></Table.Cell><Table.Cell><Button className="table-action" onPress={() => { setEditingId(event.id); setForm(event); setError(""); }} size="sm" variant="ghost">Edit</Button></Table.Cell></Table.Row>; })}</Table.Body></Table.Content></Table.ScrollContainer></Table></div><p className="event-master-note">Referenced events are not deleted here. Change status to Completed to remove an event from new-request selection.</p></Card>
  </div>;
}

function AdminDirectory({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <div className="admin-directory">
      {Object.entries(administrationData).map(([slug, data]) => (
        <Link href={`/admin/${slug}`} key={slug}>
          <span>{data.eyebrow}</span>
          <strong>{data.title}</strong>
          <small>View records and prototype actions</small>
        </Link>
      ))}
      {isSuperAdmin ? <><Link href="/admin/users"><span>Master data</span><strong>People / Users</strong><small>Roles, scope, status, and Vendor association</small></Link><Link href="/admin/audit"><span>Administration</span><strong>Audit Trail</strong><small>Who changed what, when</small></Link></> : null}
    </div>
  );
}

function AdminTable({ data }: { data: (typeof administrationData)[string] }) {
  return (
    <Card className="data-panel">
      <div className="data-panel__bar">
        <strong>{data.rows.length} records</strong>
        <span className="text-sm text-muted-foreground">Reference fixture · view only</span>
      </div>
      <div className="data-table-wrap">
        <Table><Table.ScrollContainer><Table.Content aria-label={`${data.title} records`}>
          <Table.Header>
              {data.columns.map((column, index) => (
                <Table.Column isRowHeader={index === 0} key={column}>{column}</Table.Column>
              ))}
              <Table.Column aria-label="Actions" />
          </Table.Header>
          <Table.Body>
            {data.rows.map((row) => (
              <Table.Row id={data.columns.map((column) => row[column]).join("-")} key={data.columns.map((column) => row[column]).join("-")}>
                {data.columns.map((column) => (
                  <Table.Cell key={column}>
                    {column === "Status" ? (
                      <Chip className={`data-status data-status--${row[column].toLowerCase()}`} size="sm" variant="soft">
                        {row[column]}
                      </Chip>
                    ) : (
                      row[column]
                    )}
                  </Table.Cell>
                ))}
                <Table.Cell>—</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content></Table.ScrollContainer></Table>
      </div>
    </Card>
  );
}
