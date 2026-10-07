"use client";

import { useMemo, useState } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { Field } from "@/components/shared/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { getRegisteredLocation, registeredLocations } from "@/lib/fixtures/registered-locations";
import type { AssetCondition } from "@/types/prototype";

const requiredEvidence = ["Front", "Left side", "Detail"] as const;

export function TransferScreen() {
  const { assets, planTransfer } = usePrototype();
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [destinationId, setDestinationId] = useState("");
  // Audit actor and physical handover/receiving PIC are different dimensions.
  const [responsibleParty, setResponsibleParty] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("Good");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const asset = assets.find((candidate) => candidate.id === assetId);
  const destination = getRegisteredLocation(destinationId);
  const canSubmit = Boolean(asset && destination && responsibleParty.trim() && evidence.length === requiredEvidence.length);
  const evidenceLabel = useMemo(() => `${evidence.length}/${requiredEvidence.length} required views`, [evidence.length]);
  const toggleEvidence = (view: string) => setEvidence((current) => current.includes(view) ? current.filter((item) => item !== view) : [...current, view]);

  return <AppShell pageLabel="Transfer / handover"><div className="transfer-screen">
    <section className="screen-intro"><p>Asset operations</p><h1>Transfer / handover</h1><span>Move an asset to a governed destination with condition evidence and a receiving owner.</span></section>
    <div className="transfer-layout">
      <Card><CardHeader><CardTitle>Movement details</CardTitle></CardHeader><CardContent className="transfer-form">
        <Field label="Asset"><Select onValueChange={setAssetId} value={assetId}><SelectTrigger aria-label="Transfer asset"><SelectValue placeholder="Select asset" /></SelectTrigger><SelectContent>{assets.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.location}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Destination"><Select onValueChange={setDestinationId} value={destinationId}><SelectTrigger aria-label="Transfer destination"><SelectValue placeholder="Search governed destinations" /></SelectTrigger><SelectContent>{registeredLocations.map((location) => <SelectItem key={location.id} value={location.id}>{location.vendorName ? `${location.vendorName} · ` : ""}{location.name}, {location.city}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Responsible party"><Input aria-label="Responsible party" onChange={(event) => setResponsibleParty(event.target.value)} placeholder="Actual receiving person" value={responsibleParty} /></Field>
        <Field label="Purpose"><Input defaultValue="Workshop preparation" /></Field>
        <Field label="Notes"><Textarea onChange={(event) => setNotes(event.target.value)} placeholder="Optional handover notes" value={notes} /></Field>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Condition evidence</CardTitle><Badge variant={canSubmit ? "secondary" : "outline"}>{evidenceLabel}</Badge></CardHeader><CardContent className="transfer-form">
        <Field label="Condition"><Select onValueChange={(value) => setCondition(value as AssetCondition)} value={condition}><SelectTrigger aria-label="Transfer condition"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Good">Good</SelectItem><SelectItem value="Fair">Fair</SelectItem><SelectItem value="Needs review">Needs review</SelectItem></SelectContent></Select></Field>
        <div className="transfer-evidence"><Label>Required photo views</Label>{requiredEvidence.map((view) => <label className="transfer-evidence__item" key={view}><Checkbox checked={evidence.includes(view)} onCheckedChange={() => toggleEvidence(view)} /><span><strong>{view}</strong><small>{view === "Detail" ? "Close-up of the important component" : `Full ${view.toLowerCase()} view`}</small></span></label>)}</div>
        <div className="transfer-summary"><strong>{asset?.name ?? "Select an asset"}</strong><span>{asset?.location ?? "Current location"} → {destination ? `${destination.name}, ${destination.city}` : "Select destination"}</span><small>Receiving owner · {responsibleParty || "Choose the actual receiving person"}</small></div>
        {error ? <p role="alert">{error}</p> : null}
        <Button disabled={!canSubmit || submitted} onClick={() => { try { planTransfer({ assetId, destinationId, responsibleParty, condition, evidence, notes }); setSubmitted(true); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit transfer plan."); } }} type="button">{submitted ? "Submitted for confirmation" : "Submit for confirmation"}</Button>
      </CardContent></Card>
    </div>
  </div></AppShell>;
}
