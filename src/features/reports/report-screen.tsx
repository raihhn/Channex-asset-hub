"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card, Chip, Input } from "@heroui/react";

import { AppShell } from "@/components/shared/app-shell";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { brandReferences } from "@/lib/fixtures/organization";
import { vendors } from "@/lib/fixtures/vendors";
import { deriveOperationalReport, filterOperationalReport, reportCsv, validateReportDateRange, type ReportCategory, type ReportEntry, type ReportFilters } from "@/lib/domain/reporting";

const categories: ReportCategory[] = ["Request", "Approval", "Transfer", "Return", "Inspection", "Issue", "Maintenance", "Financial reference"];

export function ReportScreen() {
  const data = usePrototype();
  const { requests, assets, events, wbsReferences } = data;
  const [draft, setDraft] = useState<ReportFilters>({ from: "", to: "" });
  const [applied, setApplied] = useState<ReportFilters | null>(null);
  const [error, setError] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const entries = useMemo(() => deriveOperationalReport(data), [data]);
  const results = useMemo(() => applied ? filterOperationalReport(entries, applied, wbsReferences, assets) : [], [applied, entries, wbsReferences, assets]);
  const setFilter = (patch: Partial<ReportFilters>) => { setDraft((current) => ({ ...current, ...patch })); setApplied(null); setError(""); };
  const selectOptions = (items: { value: string; label: string }[]) => [{ value: "all", label: "All" }, ...items];
  const selectValue = (value: string | undefined) => value || "all";
  const selectedValue = (value: string) => value === "all" ? undefined : value;
  const eventOptions = [
    ...events.map((event) => ({ value: event.id, label: `${event.name} · ${event.id}` })),
    ...requests.filter((request) => request.eventMode === "Ad-hoc Event" || request.usageType === "Ad-hoc").map((request) => ({ value: `activity:${request.id}`, label: `${request.activityName ?? request.projectName ?? request.purpose} · ad-hoc ${request.id}` })),
  ];
  const statusOptions = [...new Set(entries.map((entry) => entry.status))].sort().map((status) => ({ value: status, label: status }));
  const run = () => { try { validateReportDateRange(draft.from, draft.to); setApplied({ ...draft }); setError(""); setShowMobileFilters(false); } catch (cause) { setApplied(null); setError(cause instanceof Error ? cause.message : "Choose a valid date range."); } };
  const exportFiltered = () => {
    if (!applied) return;
    const csv = reportCsv(results, data);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `assethub-operational-report-${applied.from}-to-${applied.to}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return <AppShell pageLabel="Reports"><main className="report-screen space-y-6">
    <header className="space-y-1"><p className="text-sm font-semibold text-primary">OPERATIONAL REPORT</p><h1 className="text-3xl font-semibold">Operational history</h1><p className="text-muted-foreground">A dated trail of recorded work and its manual business references. This is not the Audit Trail, Calendar, or a finance ledger.</p></header>
    <Card className="space-y-5 p-5" aria-label="Report filters">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end"><label className="block space-y-1 text-sm">From Date<Input className="w-full" type="date" aria-label="From Date" value={draft.from} onChange={(event) => setFilter({ from: event.target.value })} /></label><label className="block space-y-1 text-sm">To Date<Input className="w-full" type="date" aria-label="To Date" value={draft.to} onChange={(event) => setFilter({ to: event.target.value })} /></label><Button variant="primary" onPress={run}>Apply report</Button></div>
      <Button className="w-full border border-primary/30 bg-card text-primary lg:hidden" variant="secondary" onPress={() => setShowMobileFilters((value) => !value)}>{showMobileFilters ? "Hide filters" : "More filters"}</Button>
      <div className={`${showMobileFilters ? "grid" : "hidden lg:grid"} gap-3 sm:grid-cols-2 xl:grid-cols-4`}>
        <HeroSelect label="Brand" value={selectValue(draft.brandId)} onChange={(value) => setFilter({ brandId: selectedValue(value) })} options={selectOptions(brandReferences.map((brand) => ({ value: brand.id, label: brand.name })))} />
        <HeroSelect label="Event / Activity" value={selectValue(draft.eventKey)} onChange={(value) => setFilter({ eventKey: selectedValue(value) })} options={selectOptions(eventOptions)} />
        <HeroSelect label="Request" value={selectValue(draft.requestId)} onChange={(value) => setFilter({ requestId: selectedValue(value) })} options={selectOptions(requests.map((request) => ({ value: request.id, label: `${request.id} · ${request.projectName ?? request.purpose}` })))} />
        <HeroSelect label="Physical Asset" value={selectValue(draft.assetId)} onChange={(value) => setFilter({ assetId: selectedValue(value) })} options={selectOptions(assets.map((asset) => ({ value: asset.id, label: `${asset.name} · ${asset.code}` })))} />
        <HeroSelect label="Vendor" value={selectValue(draft.vendorId)} onChange={(value) => setFilter({ vendorId: selectedValue(value) })} options={selectOptions(vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })))} />
        <HeroSelect label="WBS" value={selectValue(draft.wbsReferenceId)} onChange={(value) => setFilter({ wbsReferenceId: selectedValue(value) })} options={selectOptions(wbsReferences.map((reference) => ({ value: reference.id, label: reference.code })))} />
        <HeroSelect label="Operation type" value={selectValue(draft.category)} onChange={(value) => setFilter({ category: selectedValue(value) as ReportCategory | undefined })} options={selectOptions(categories.map((category) => ({ value: category, label: category })))} />
        <HeroSelect label="Status" value={selectValue(draft.status)} onChange={(value) => setFilter({ status: selectedValue(value) })} options={selectOptions(statusOptions)} />
      </div>
      <div className={`${showMobileFilters ? "grid" : "hidden lg:grid"} gap-3 sm:grid-cols-2`}><label className="block space-y-1 text-sm">PR / PO / Invoice Number<Input className="w-full" aria-label="Reference number filter" placeholder="Filter manual reference" value={draft.referenceQuery ?? ""} onChange={(event) => setFilter({ referenceQuery: event.target.value })} /></label><label className="block space-y-1 text-sm">Search history<Input className="w-full" aria-label="Search history" placeholder="Request, Asset, Event, Vendor, WBS..." value={draft.search ?? ""} onChange={(event) => setFilter({ search: event.target.value })} /></label></div>
      {showMobileFilters ? <Button className="w-full lg:hidden" variant="primary" onPress={run}>Apply filters</Button> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">Filters combine with AND. Area/DC attribution is not applied because current records do not establish one reliable organizational owner.</p>
    </Card>
    {!applied ? <Card className="p-8 text-center text-muted-foreground">Choose From Date and To Date, then apply the report. No all-time history or export is available.</Card> : <section className="space-y-4" aria-label="Operational history results">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Activity · {results.length} records</h2><p className="text-sm text-muted-foreground">{applied.from} to {applied.to} · newest first</p></div><Button variant="secondary" isDisabled={!results.length} onPress={exportFiltered}>Export filtered CSV</Button></div>
      {results.length ? <ol className="space-y-3">{results.map((entry) => <ReportRow key={entry.id} entry={entry} data={data} />)}</ol> : <Card className="p-8 text-center text-muted-foreground">No activity found for this period and filter set.</Card>}
    </section>}
  </main></AppShell>;
}

function ReportRow({ entry, data }: { entry: ReportEntry; data: ReturnType<typeof usePrototype> }) {
  const brand = brandReferences.find((item) => item.id === entry.brandId)?.name;
  const vendor = vendors.find((item) => item.id === entry.vendorId)?.name;
  const assetNames = entry.assetIds.map((id) => data.assets.find((asset) => asset.id === id)?.name ?? id);
  const wbs = entry.wbsReferenceIds.map((id) => data.wbsReferences.find((reference) => reference.id === id)?.code ?? id);
  const occurred = entry.occurredAt.includes("T") ? new Date(entry.occurredAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : entry.occurredAt;
  return <li><Card className="p-4"><div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:gap-3"><div className="flex items-center justify-between gap-2 text-sm text-muted-foreground sm:block"><span>{occurred}</span><span className="text-xs sm:hidden">{entry.status}</span></div><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><strong>{entry.type}</strong><Chip size="sm" variant="soft">{entry.category}</Chip></div><p className="text-sm">{entry.summary}</p><p className="text-xs text-muted-foreground">{[brand, entry.eventName, entry.requestId, vendor].filter(Boolean).join(" · ")}</p></div><span className="hidden text-xs text-muted-foreground sm:block">{entry.status}</span></div><details className="mt-3 border-t border-border pt-3 text-sm"><summary className="cursor-pointer text-primary">Details and references</summary><div className="mt-3 grid gap-2 sm:grid-cols-2"><p>Asset: {assetNames.length ? assetNames.join(" · ") : "—"}</p><p>Vendor: {vendor ?? "—"}</p><p>WBS: {wbs.length ? wbs.join(" · ") : "—"}</p><p>PR: {entry.referenceNumbers.PR.join(" · ") || "—"}</p><p>PO: {entry.referenceNumbers.PO.join(" · ") || "—"}</p><p>Invoice: {entry.referenceNumbers.INVOICE.join(" · ") || "—"}</p><p>Actor: {entry.actorName ?? "Not recorded"}</p><p>Location: {entry.location ?? "—"}</p></div><div className="mt-3 flex flex-wrap gap-4">{entry.requestId ? <Link className="text-primary underline" href={`/requests/${entry.requestId}`}>Open Request</Link> : null}{entry.assetIds.length === 1 ? <Link className="text-primary underline" href={`/assets/${entry.assetIds[0]}`}>Open Asset</Link> : null}{entry.maintenanceId ? <Link className="text-primary underline" href={`/maintenance/${entry.maintenanceId}`}>Open Maintenance</Link> : null}</div></details></Card></li>;
}
