"use client";

import { useState } from "react";
import { Button, Card, Input } from "@heroui/react";

import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { referencesForOwner } from "@/lib/domain/financial-references";
import type { FinancialReference } from "@/types/prototype";

export function FinancialReferencesSection({ ownerType, ownerId, wbsCodes = [], budgetCode }: {
  ownerType: FinancialReference["ownerType"];
  ownerId: string;
  wbsCodes?: string[];
  budgetCode?: string;
}) {
  const { currentUser, financialReferences, addFinancialReference, updateFinancialReference, removeFinancialReference } = usePrototype();
  const [type, setType] = useState<FinancialReference["type"]>("PR");
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [error, setError] = useState("");
  const references = referencesForOwner(financialReferences, { ownerType, ownerId });
  const canEdit = currentUser.roles.includes("SUPER_ADMIN");
  const run = (action: () => void) => { try { action(); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this reference."); } };

  return <Card className="space-y-4 p-5" aria-label="Financial references">
    <div><p className="text-sm text-muted-foreground">Financial references</p><h2 className="text-lg font-semibold">WBS · PR · PO · Invoice</h2><p className="text-sm text-muted-foreground">Manual references only · not externally verified. These are not budget or payment statuses.</p></div>
    {ownerType === "REQUEST" ? <div className="grid gap-3 sm:grid-cols-2"><div><strong className="text-sm">Budget code</strong><p className="text-sm">{budgetCode || "Not provided"}</p></div><div><strong className="text-sm">WBS</strong><p className="text-sm">{wbsCodes.length ? wbsCodes.join(" · ") : "Not provided · optional"}</p></div></div> : null}
    {references.length ? <ul className="space-y-2">{references.map((reference) => <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm" key={reference.id}>
      <strong className="min-w-16">{reference.type === "INVOICE" ? "Invoice" : reference.type}</strong>
      {editingId === reference.id ? <><Input aria-label={`Edit ${reference.type} Number`} className="min-w-36 flex-1" value={editingValue} onChange={(event) => setEditingValue(event.target.value)} /><Button size="sm" variant="primary" onPress={() => run(() => { updateFinancialReference(reference.id, editingValue); setEditingId(""); })}>Save</Button><Button size="sm" variant="secondary" onPress={() => setEditingId("")}>Cancel</Button></> : <><span className="min-w-0 flex-1 break-all">{reference.value}</span>{canEdit ? <><Button size="sm" variant="secondary" onPress={() => { setEditingId(reference.id); setEditingValue(reference.value); }}>Edit</Button><Button size="sm" variant="secondary" onPress={() => run(() => removeFinancialReference(reference.id))}>Remove</Button></> : null}</>}
    </li>)}</ul> : <p className="text-sm text-muted-foreground">No PR, PO, or Invoice Number recorded.</p>}
    {canEdit ? <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end"><HeroSelect label="Reference type" value={type} onChange={(next) => setType(next as FinancialReference["type"])} options={[{ value: "PR", label: "PR Number" }, { value: "PO", label: "PO Number" }, { value: "INVOICE", label: "Invoice Number" }]} /><label className="block space-y-1 text-sm">Number<Input className="w-full" aria-label="Financial reference number" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Enter manual reference" /></label><Button variant="primary" onPress={() => run(() => { addFinancialReference(ownerType, ownerId, type, value); setValue(""); })}>Add reference</Button></div> : <p className="text-xs text-muted-foreground">Only the prototype Super Admin can edit these references.</p>}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </Card>;
}
