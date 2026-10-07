"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { Button, Card, Chip, Input, TextArea } from "@heroui/react";

import { AppShell } from "@/components/shared/app-shell";
import { HeroSelect } from "@/components/shared/hero-select";
import { FinancialReferencesSection } from "@/components/domain/financial-references-section";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { activeMaintenanceForAsset } from "@/lib/domain/maintenance";
import { vendors, getVendor } from "@/lib/fixtures/vendors";
import type { AssetCondition } from "@/types/prototype";

function Message({ children }: { children: string }) {
  return <p role="alert" className="text-sm text-destructive">{children}</p>;
}

export function MaintenanceCreateScreen({ assetId = "", requestId, requestItemId, issueId }: {
  assetId?: string; requestId?: string; requestItemId?: string; issueId?: string;
}) {
  const router = useRouter();
  const { assets, maintenanceRecords, createMaintenance } = usePrototype();
  const [selectedAssetId, setSelectedAssetId] = useState(assetId);
  const [selectedIssueId, setSelectedIssueId] = useState(issueId ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const asset = assets.find((item) => item.id === selectedAssetId);
  const active = selectedAssetId ? activeMaintenanceForAsset(maintenanceRecords, selectedAssetId) : undefined;
  return <AppShell pageLabel="Create maintenance"><main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-6">
    <Link href={asset ? `/assets/${asset.id}` : "/operations"}>← Back</Link>
    <header><p className="text-sm text-muted-foreground">ASSET OPERATIONS</p><h1 className="text-3xl font-semibold">Create maintenance</h1><p>One maintenance record covers one physical Asset. Creating it does not start Vendor work.</p></header>
    <Card className="space-y-5 p-6">
      <HeroSelect label="Physical Asset" value={selectedAssetId} onChange={(value) => { setSelectedAssetId(value); setSelectedIssueId(""); }} options={assets.filter((item) => item.trackingType !== "Quantity-based").map((item) => ({ value: item.id, label: `${item.name} · ${item.code}` }))} />
      {asset ? <><p className="text-sm">{asset.location} · Condition {asset.condition} · {asset.availability}</p>
        <HeroSelect label="Linked Issue (optional)" value={selectedIssueId} onChange={setSelectedIssueId} options={asset.issues.filter((item) => item.status !== "Resolved").map((item) => ({ value: item.id, label: `${item.type} · ${item.id}` }))} />
      </> : null}
      <div className="space-y-2"><label htmlFor="maintenance-reason" className="block">Reason / scope of work</label><TextArea id="maintenance-reason" className="w-full" aria-label="Reason / scope of work" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What needs repair or inspection?" /></div>
      {requestItemId ? <p className="text-sm">Returned item {requestItemId} · Request {requestId}. Confirmed receipt is required.</p> : null}
      {active ? <p className="text-sm">Active maintenance already exists: <Link href={`/maintenance/${active.id}`}>{active.id}</Link></p> : null}
      {error ? <Message>{error}</Message> : null}
      <Button variant="primary" isDisabled={!asset || Boolean(active) || (!reason.trim() && !selectedIssueId)} onPress={() => {
        try {
          const record = createMaintenance(selectedAssetId, { reason, issueId: selectedIssueId || undefined, sourceRequestId: requestId, sourceRequestItemId: requestItemId });
          router.push(`/maintenance/${record.id}`);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create maintenance."); }
      }}>Create maintenance</Button>
    </Card>
  </main></AppShell>;
}

export function MaintenanceDetailScreen({ maintenanceId }: { maintenanceId: string }) {
  const { assets, maintenanceRecords, assignMaintenanceVendor, addMaintenanceEvidence, startMaintenanceWork, completeVendorWork, acceptMaintenance, holdMaintenance, resumeMaintenance, cancelMaintenance } = usePrototype();
  const record = maintenanceRecords.find((item) => item.id === maintenanceId);
  const asset = assets.find((item) => item.id === record?.assetId);
  const [vendorId, setVendorId] = useState(record?.vendorId ?? "");
  const [reportedBy, setReportedBy] = useState("");
  const [condition, setCondition] = useState<AssetCondition | "">(record?.conditionAfter ?? "");
  const [resolveIssue, setResolveIssue] = useState(false);
  const [clearInspection, setClearInspection] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const act = (action: () => void) => { try { action(); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed."); } };
  const upload = (purpose: "Before" | "After") => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { setError("Choose an image under 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => act(() => addMaintenanceEvidence(maintenanceId, purpose, { dataUrl: String(reader.result), mimeType: file.type, name: file.name }));
    reader.onerror = () => setError("Could not read image.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };
  if (!record || !asset) return <AppShell pageLabel="Maintenance"><main className="mx-auto max-w-3xl px-4 py-6"><h1>Maintenance not found</h1><Link href="/operations">Back to Operations</Link></main></AppShell>;
  const before = asset.photos.filter((photo) => record.beforePhotoIds.includes(photo.id));
  const after = asset.photos.filter((photo) => record.afterPhotoIds.includes(photo.id));
  return <AppShell pageLabel="Maintenance"><main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-6">
    <Link href="/operations">← Operations</Link>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{record.id}</p><h1 className="text-3xl font-semibold">{asset.name}</h1><p>{record.reason}</p></div><Chip color={record.status === "Accepted" ? "success" : record.status === "Cancelled" ? "default" : "warning"} variant="soft">{record.status}</Chip></header>
    <Card className="space-y-3 p-5"><h2 className="text-lg font-semibold">Context</h2><p>Asset: <Link href={`/assets/${asset.id}`}>{asset.code}</Link> · {asset.location}</p><p>Condition: {record.conditionBefore} → {record.conditionAfter ?? "Pending acceptance"}</p><p>Vendor: {getVendor(record.vendorId)?.name ?? "Not assigned"}</p>{record.issueId ? <p>Linked Issue: {record.issueId}</p> : null}{record.sourceRequestId ? <p>Source: <Link href={`/requests/${record.sourceRequestId}`}>{record.sourceRequestId}</Link> · {record.sourceRequestItemId}</p> : null}</Card>
    <FinancialReferencesSection ownerType="MAINTENANCE" ownerId={record.id} />
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-3 p-5"><h2 className="font-semibold">Before Photo <span className="text-destructive">required</span></h2><Evidence photos={before} />{["Draft", "Vendor assigned"].includes(record.status) ? <label className="block text-sm">Upload Before Photo<input className="mt-2 block w-full" aria-label="Upload Before Photo" type="file" accept="image/*" onChange={upload("Before")} /></label> : null}</Card>
      <Card className="space-y-3 p-5"><h2 className="font-semibold">After Photo <span className="text-destructive">required</span></h2><Evidence photos={after} />{record.status === "In progress" ? <label className="block text-sm">Upload After Photo<input className="mt-2 block w-full" aria-label="Upload After Photo" type="file" accept="image/*" onChange={upload("After")} /></label> : null}</Card>
    </div>
    {record.status === "Draft" || record.status === "Vendor assigned" ? <Card className="space-y-4 p-5"><h2 className="font-semibold">Vendor assignment and work start</h2><HeroSelect label="Registered Vendor" value={vendorId} onChange={setVendorId} options={vendors.map((vendor) => ({ value: vendor.id, label: vendor.name }))} /><div className="flex flex-wrap gap-3"><Button variant="primary" isDisabled={!vendorId} onPress={() => act(() => assignMaintenanceVendor(maintenanceId, vendorId))}>Assign Vendor</Button><Button isDisabled={record.status !== "Vendor assigned" || before.length === 0} onPress={() => act(() => startMaintenanceWork(maintenanceId))}>Start work</Button></div><p className="text-sm">Assign a registered Vendor and add a real Before Photo before work can start.</p></Card> : null}
    {record.status === "In progress" ? <Card className="space-y-4 p-5"><h2 className="font-semibold">Vendor work completion</h2><label className="block space-y-2">Reported by<Input aria-label="Vendor completion reported by" value={reportedBy} onChange={(event) => setReportedBy(event.target.value)} placeholder="Name of Vendor representative or internal recorder" /></label><Button variant="primary" isDisabled={!reportedBy.trim() || after.length === 0} onPress={() => act(() => completeVendorWork(maintenanceId, reportedBy))}>Mark Vendor work completed</Button><p className="text-sm">This does not accept maintenance or restore availability.</p></Card> : null}
    {record.status === "Work completed" ? <Card className="space-y-4 p-5"><h2 className="font-semibold">Internal acceptance</h2><p>Inspect the work and evidence before deciding. Vendor completion alone does not close maintenance.</p><HeroSelect label="Condition after" value={condition} onChange={(value) => setCondition(value as AssetCondition)} options={["Good", "Fair", "Needs review"].map((value) => ({ label: value, value }))} />{record.issueId ? <label className="flex gap-2"><input type="checkbox" checked={resolveIssue} onChange={(event) => setResolveIssue(event.target.checked)} />Resolve only linked Issue {record.issueId}</label> : null}{asset.inspectionState && asset.inspectionState !== "Clear" ? <label className="flex gap-2"><input type="checkbox" checked={clearInspection} onChange={(event) => setClearInspection(event.target.checked)} />Clear prior inspection hold after verification</label> : null}<Button variant="primary" isDisabled={!condition} onPress={() => act(() => acceptMaintenance(maintenanceId, { conditionAfter: condition as AssetCondition, resolveLinkedIssue: resolveIssue, clearInspection }))}>Accept maintenance</Button><div className="space-y-2"><label htmlFor="maintenance-send-back" className="block">Send-back reason</label><TextArea id="maintenance-send-back" className="w-full" aria-label="Send-back reason" value={reason} onChange={(event) => setReason(event.target.value)} /></div><Button isDisabled={!reason.trim()} onPress={() => act(() => holdMaintenance(maintenanceId, reason))}>Send back for rework</Button></Card> : null}
    {record.status === "On hold" ? <Card className="space-y-3 p-5"><h2 className="font-semibold">Rework on hold</h2><p>{record.notes}</p><Button variant="primary" onPress={() => act(() => resumeMaintenance(maintenanceId))}>Resume work · new After Photo required</Button></Card> : null}
    {["Draft", "Vendor assigned", "In progress", "Work completed", "On hold"].includes(record.status) ? <Card className="space-y-3 p-5"><h2 className="font-semibold">Cancel maintenance</h2><p>Cancellation does not make the Asset available; it stays blocked for reassessment.</p><TextArea aria-label="Cancellation reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for cancellation" /><Button isDisabled={!reason.trim()} onPress={() => act(() => cancelMaintenance(maintenanceId, reason))}>Cancel maintenance</Button></Card> : null}
    {error ? <Message>{error}</Message> : null}
    <Card className="p-5"><h2 className="mb-3 font-semibold">Activity</h2><ol className="space-y-3">{record.activity.map((item, index) => <li key={`${item.at}-${index}`} className="border-b pb-2 text-sm"><strong>{item.title}</strong><span className="ml-2 text-muted-foreground">{new Date(item.at).toLocaleString("en-GB")}</span><p>{item.detail}</p></li>)}</ol></Card>
  </main></AppShell>;
}

function Evidence({ photos }: { photos: { id: string; dataUrl?: string; caption: string }[] }) {
  return photos.length ? <div className="grid grid-cols-2 gap-2">{photos.map((photo) => <div key={photo.id}>{photo.dataUrl ? <Image className="aspect-square w-full rounded-lg object-cover" src={photo.dataUrl} alt={photo.caption} width={320} height={320} unoptimized /> : null}<small>{photo.caption}</small></div>)}</div> : <p className="text-sm text-muted-foreground">No image uploaded yet.</p>;
}
