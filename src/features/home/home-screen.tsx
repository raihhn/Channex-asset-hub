"use client";

import Link from "next/link";
import { ArrowUpRight, Box, ClipboardCheck, Search, Wrench } from "lucide-react";
import { Card, Chip } from "@heroui/react";

import { RequestStatus } from "@/components/domain/request-status";
import { AppShell } from "@/components/shared/app-shell";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { getFixtureAsset } from "@/lib/fixtures/prototype-data";

export function HomeScreen() {
  const { assets, requests, role } = usePrototype();
  const attention = assets.filter((asset) => asset.condition === "Needs review" || asset.issues.some((issue) => issue.status !== "Resolved") || asset.availability === "maintenance");
  const activeRequests = requests.filter((request) => request.status !== "Completed");
  return <AppShell pageLabel="Today"><div className="today-screen">
    <section className="today-hero"><div><p>AssetHub / Today</p><h1>Work that needs a decision.</h1><span>Find, book, hand over, and return event assets without losing operational context.</span></div><Link className="today-hero__action" href="/assets"><Search size={17} /> Find an asset</Link></section>
    <section className="today-actions" aria-label="Start an action">
      <Link href="/assets"><span><Search size={19} /></span><strong>Explore inventory</strong><small>Check what already exists</small><ArrowUpRight size={16} /></Link>
      <Link href="/request/new"><span><ClipboardCheck size={19} /></span><strong>Create a request</strong><small>Build a booking workspace</small><ArrowUpRight size={16} /></Link>
      <Link href="/operations"><span><Wrench size={19} /></span><strong>Resolve operations</strong><small>Review asset health and returns</small><ArrowUpRight size={16} /></Link>
    </section>
    <section className="today-layout">
      <Card className="work-queue"><header><div><p>Your queue</p><h2>Requests in motion</h2></div><Link href="/requests">View all</Link></header><div>{activeRequests.slice(0, 5).map((request) => { const asset = getFixtureAsset(request.items[0]?.assetId); return <Link href={`/requests/${request.id}`} key={request.id}><span className="work-queue__mark">{asset?.brand.slice(0, 1) ?? "A"}</span><span><strong>{asset?.name ?? "Asset request"}</strong><small>{request.destination} · {request.startDate}</small></span><RequestStatus status={request.status} /></Link>; })}</div></Card>
      <Card className="attention-queue"><header><div><p>Asset readiness</p><h2>Needs attention</h2></div><Chip color="warning" size="sm" variant="soft">{attention.length} items</Chip></header><div>{attention.slice(0, 4).map((asset) => <Link href={`/assets/${asset.id}`} key={asset.id}><span><Wrench size={16} /></span><p><strong>{asset.name}</strong><small>{asset.lifecycleNote ?? `${asset.issues.length} open issue(s)`}</small></p><ArrowUpRight size={16} /></Link>)}</div><Link className="attention-queue__footer" href="/operations">Open operations queue <ArrowUpRight size={15} /></Link></Card>
    </section>
    <section className="today-footnote"><Box size={17} /><span><strong>{assets.filter((asset) => asset.availability === "available").length} assets are currently available.</strong> Search inventory before requesting something new.</span>{role === "Approver" ? <Link href="/requests/approvals">Approval inbox</Link> : null}</section>
  </div></AppShell>;
}
