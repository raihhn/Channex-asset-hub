"use client";

import Link from "next/link";
import { Avatar, Card } from "@heroui/react";

import { AppShell } from "@/components/shared/app-shell";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import type { PrototypeRole } from "@/types/prototype";
import { roleLabels, userHasRole } from "@/lib/domain/people";

export function MeScreen() {
  const { role, setRole, people, currentUser, setCurrentUserId } = usePrototype();
  const roles: PrototypeRole[] = [
    "Viewer",
    "Requester",
    "Asset Ops",
    "Approver",
    "System Admin",
  ];
  return (
    <AppShell pageLabel={currentUser.name}>
      <div className="me-screen">
        <section className="screen-intro">
          <p>Profile</p>
          <h1>{currentUser.name}</h1>
          <span>{currentUser.roles.map((item) => roleLabels[item]).join(" · ")} · Prototype identity</span>
        </section>
        <Card className="prototype-role-switcher"><Avatar><Avatar.Fallback>{currentUser.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</Avatar.Fallback></Avatar><div className="w-full space-y-3"><p className="text-sm">Development utility only · switching does not authenticate or enforce production permissions.</p><HeroSelect label="Current prototype user" onChange={setCurrentUserId} options={people.filter((person) => person.status === "ACTIVE").map((person) => ({ label: `${person.name} · ${person.roles.map((item) => roleLabels[item]).join(", ")}`, value: person.id }))} value={currentUser.id} /><HeroSelect label="Legacy development role view" onChange={(value) => setRole(value as PrototypeRole)} options={roles.map((item) => ({ label: item, value: item }))} value={role} /></div></Card>
        <div className="me-screen__links">
          <Link href="/requests">
            <strong>My requests</strong>
            <span>Track bookings and next actions</span>
          </Link>
          <Link href="/requests/approvals">
            <strong>Approval queue</strong>
            <span>Authorized prototype access</span>
          </Link>
          <Link href="/reports">
            <strong>Reports</strong>
            <span>Operational availability and condition</span>
          </Link>
          <Link href="/admin">
            <strong>Administration</strong>
            <span>Master data and approval structure</span>
          </Link>
          {userHasRole(currentUser, "SUPER_ADMIN") ? <><Link href="/admin/users"><strong>People / Users</strong><span>Roles and business scope</span></Link><Link href="/admin/audit"><strong>Audit Trail</strong><span>Cross-domain mutation history</span></Link></> : null}
          {role === "Asset Ops" || role === "System Admin" ? (
            <Link href="/operations">
              <strong>Asset Operations</strong>
              <span>Health, maintenance, and setup work</span>
            </Link>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
