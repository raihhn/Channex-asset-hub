"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button, Card, Chip, Input } from "@heroui/react";

import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { roleLabels, scopeWarnings } from "@/lib/domain/people";
import { areas, brandReferences, categoryReferences, distributionCenters } from "@/lib/fixtures/organization";
import { vendors, getVendor } from "@/lib/fixtures/vendors";
import { userRoles, type PersonDraft, type UserRole } from "@/types/identity";

const emptyDraft: PersonDraft = { name: "", email: "", roles: [], status: "ACTIVE", brandIds: [], categoryIds: [], areaIds: [], dcIds: [] };

function ScopeChecks({ label, options, selected, onChange }: { label: string; options: readonly { id: string; name: string }[]; selected: string[]; onChange: (values: string[]) => void }) {
  return <fieldset className="space-y-2"><legend className="font-semibold">{label}</legend><div className="flex flex-wrap gap-2">{options.map((option) => <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${selected.includes(option.id) ? "border-primary bg-accent" : "border-border"}`} key={option.id}><input type="checkbox" checked={selected.includes(option.id)} onChange={(event) => onChange(event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))} />{option.name}</label>)}</div></fieldset>;
}

export function PeopleMasterScreen() {
  const { people, currentUser, createPerson, updatePerson, setPersonStatus } = usePrototype();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<PersonDraft>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const visible = useMemo(() => people.filter((person) => `${person.name} ${person.email} ${person.roles.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [people, query]);
  const openNew = () => { setEditingId(undefined); setForm(emptyDraft); setError(""); setShowForm(true); };
  const openEdit = (id: string) => { const person = people.find((item) => item.id === id)!; setEditingId(id); setForm({ name: person.name, email: person.email, roles: [...person.roles], status: person.status, brandIds: [...person.brandIds], categoryIds: [...person.categoryIds], areaIds: [...person.areaIds], dcIds: [...person.dcIds], vendorId: person.vendorId }); setError(""); setShowForm(true); };
  const save = (event: FormEvent) => { event.preventDefault(); try { if (editingId) updatePerson(editingId, form); else createPerson(form); setShowForm(false); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save user."); } };
  const toggleRole = (role: UserRole) => setForm((current) => ({ ...current, roles: current.roles.includes(role) ? current.roles.filter((item) => item !== role) : [...current.roles, role] }));
  return <div className="space-y-5">
    <Card className="flex flex-wrap items-center justify-between gap-3 p-5"><div><strong>{people.length} people</strong><p className="text-sm text-muted-foreground">One canonical person record; roles and business scope are separate.</p></div><div className="flex flex-wrap gap-2"><Input aria-label="Search people" placeholder="Search name, email, role" value={query} onChange={(event) => setQuery(event.target.value)} /><Button variant="primary" onPress={openNew}>Add user</Button></div></Card>
    {showForm ? <Card className="space-y-5 p-5"><form className="space-y-5" onSubmit={save}>
      <div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">{editingId ? "Edit user" : "Add user"}</h2><Button type="button" variant="secondary" onPress={() => setShowForm(false)}>Cancel</Button></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="person-name">Name</label><Input id="person-name" aria-label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div><div className="space-y-2"><label htmlFor="person-email">Email</label><Input id="person-email" aria-label="Email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></div></div>
      <fieldset className="space-y-2"><legend className="font-semibold">Roles · select one or more</legend><div className="flex flex-wrap gap-2">{userRoles.map((role) => <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${form.roles.includes(role) ? "border-primary bg-accent" : "border-border"}`} key={role}><input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />{roleLabels[role]}</label>)}</div></fieldset>
      <div className="border-t border-border pt-4"><h3 className="font-semibold">Business scope</h3><p className="text-sm text-muted-foreground">Scope describes coverage; it does not route approvals or filter data yet.</p></div>
      <ScopeChecks label="Brands" options={brandReferences} selected={form.brandIds} onChange={(brandIds) => setForm((current) => ({ ...current, brandIds }))} />
      <ScopeChecks label="Categories" options={categoryReferences} selected={form.categoryIds} onChange={(categoryIds) => setForm((current) => ({ ...current, categoryIds }))} />
      <ScopeChecks label="Areas · organizational" options={areas} selected={form.areaIds} onChange={(areaIds) => setForm((current) => ({ ...current, areaIds }))} />
      <ScopeChecks label="DCs · not physical Locations" options={distributionCenters} selected={form.dcIds} onChange={(dcIds) => setForm((current) => ({ ...current, dcIds }))} />
      {form.roles.includes("VENDOR") ? <HeroSelect label="Registered Vendor" value={form.vendorId ?? ""} onChange={(vendorId) => setForm((current) => ({ ...current, vendorId }))} options={vendors.map((vendor) => ({ label: vendor.name, value: vendor.id }))} /> : null}
      {scopeWarnings(form).map((warning) => <p className="text-sm text-warning" key={warning}>{warning}</p>)}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="primary">Save user</Button>
    </form></Card> : null}
    <div className="grid gap-3">{visible.map((person) => <Card className="p-4" key={person.id}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{person.name}</strong><Chip size="sm" color={person.status === "ACTIVE" ? "success" : "default"} variant="soft">{person.status === "ACTIVE" ? "Active" : "Inactive"}</Chip></div><p className="break-all text-sm text-muted-foreground">{person.email}</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" onPress={() => openEdit(person.id)}>Edit</Button><Button size="sm" variant="ghost" isDisabled={person.id === currentUser.id && person.status === "ACTIVE"} onPress={() => { try { setPersonStatus(person.id, person.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not change status."); } }}>{person.status === "ACTIVE" ? "Inactivate" : "Activate"}</Button></div></div>
      <div className="mt-3 flex flex-wrap gap-2">{person.roles.map((role) => <Chip size="sm" variant="soft" key={role}>{roleLabels[role]}</Chip>)}</div>
      <p className="mt-3 text-sm"><span className="text-muted-foreground">Scope:</span> {person.brandIds.map((id) => brandReferences.find((item) => item.id === id)?.name).filter(Boolean).join(", ") || "No Brand"} · {person.categoryIds.map((id) => categoryReferences.find((item) => item.id === id)?.name).filter(Boolean).join(", ") || "No Category"} · {[...person.areaIds.map((id) => areas.find((item) => item.id === id)?.name), ...person.dcIds.map((id) => distributionCenters.find((item) => item.id === id)?.name)].filter(Boolean).join(", ") || "No Area/DC"}</p>
      {person.vendorId ? <p className="text-sm">Vendor: {getVendor(person.vendorId)?.name ?? "Invalid Vendor association"}</p> : null}
      {scopeWarnings(person).map((warning) => <p className="text-sm text-warning" key={warning}>{warning}</p>)}
    </Card>)}</div>
    {!visible.length ? <p>No users match this search.</p> : null}
  </div>;
}
