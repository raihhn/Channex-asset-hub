"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Radio, RadioGroup, TextArea } from "@heroui/react";

import { AppIcon } from "@/components/ui/app-icon";
import { AppShell } from "@/components/shared/app-shell";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import type { IssueDraft, IssueSeverity, IssueType } from "@/types/prototype";

const option = (value: string) => ({ label: value, value });

export function ReportIssueScreen({ assetId }: { assetId: string }) {
  const router = useRouter();
  const { assets, reportIssue } = usePrototype();
  const asset = assets.find((item) => item.id === assetId);
  const [draft, setDraft] = useState<IssueDraft>({ area: "Left side", type: "Scratch", severity: "Minor", notes: "" });
  if (!asset) return null;
  return <AppShell pageLabel="Report issue"><div className="report-issue-screen"><Link className="back-link" href={`/assets/${assetId}`}>← Back to asset</Link><p>Asset condition</p><h1>Report an issue</h1><span>Capture enough detail for an operator to assess the asset safely.</span>
    <Card className="issue-form"><HeroSelect label="Where is the issue?" onChange={(area) => setDraft((current) => ({ ...current, area }))} options={["Front", "Left side", "Right side", "Rear", "Countertop", "Other"].map(option)} value={draft.area} /><HeroSelect label="Issue type" onChange={(type) => setDraft((current) => ({ ...current, type: type as IssueType }))} options={["Scratch", "Dent", "Broken", "Missing part", "Stain", "Structural issue", "Other"].map(option)} value={draft.type} /><fieldset><legend>Severity</legend><RadioGroup aria-label="Issue severity" onChange={(severity) => setDraft((current) => ({ ...current, severity: severity as IssueSeverity }))} value={draft.severity}>{(["Minor", "Moderate", "Major"] as IssueSeverity[]).map((severity) => <Radio key={severity} value={severity}>{severity}</Radio>)}</RadioGroup></fieldset><div className="evidence-placeholder"><AppIcon name="camera" /><strong>Evidence photo</strong><span>Simulated local photo attachment</span><Button size="sm" variant="secondary">Add photo</Button></div><label>Notes<TextArea onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Describe the issue, size, and any operational impact." value={draft.notes} /></label></Card>
    <Button className="submit-issue" onPress={() => { reportIssue(assetId, draft); router.push(`/assets/${assetId}`); }} variant="primary">Submit issue</Button>
  </div></AppShell>;
}
