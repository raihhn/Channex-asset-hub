"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Boxes,
  ClipboardList,
  Database,
  LayoutDashboard,
  Radar,
  Sparkles,
} from "lucide-react";
import { Button } from "@heroui/react";

import {
  administrationNavigation,
  desktopSecondaryNavigation,
  primaryNavigation,
} from "@/lib/constants/navigation";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { roleLabels, userHasRole } from "@/lib/domain/people";

const primaryIcons = {
  home: LayoutDashboard,
  assets: Boxes,
  requests: ClipboardList,
} as const;

const secondaryIcons = {
  "/operations": Radar,
  "/transfers": ArrowRightLeft,
  "/reports": Sparkles,
  "/admin": Database,
} as const;

export function DesktopSidebar() {
  const { currentUser } = usePrototype();
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = pathname ?? "/";

  return (
    <aside className="desktop-sidebar" aria-label="Desktop navigation">
      <Link className="desktop-sidebar__brand" href="/">
        <span aria-hidden="true" className="brand-mark">AH</span>
        <span>
          AssetHub
          <small>Asset operations</small>
        </span>
      </Link>
      <nav aria-label="Primary navigation">
        <p className="nav-label">Workspace</p>
        <ul className="navigation-list">
          {primaryNavigation.map((item) => (
            <li
              className={
                currentPath === item.href ||
                (item.href !== "/" && currentPath.startsWith(item.href))
                  ? "is-active"
                  : ""
              }
              key={item.area}
            >
              <Link href={item.href}>
                {(() => {
                  const Icon = primaryIcons[item.area];
                  return <Icon size={16} />;
                })()}
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="nav-label">Manage</p>
        <ul className="navigation-list navigation-list--secondary">
          {desktopSecondaryNavigation.map((item) => (
            <li
              className={currentPath.startsWith(item.href) ? "is-active" : ""}
              key={item.label}
            >
              <Link href={item.href}>
                {(() => {
                  const Icon =
                    secondaryIcons[item.href as keyof typeof secondaryIcons];
                  return <Icon size={16} />;
                })()}
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        {currentPath.startsWith("/admin") ? (
          <ul className="navigation-list navigation-list--admin">
            {administrationNavigation.filter((item) => userHasRole(currentUser, "SUPER_ADMIN") || (item.slug !== "users" && item.slug !== "audit")).map((item) => (
              <li
                className={
                  currentPath.endsWith(`/${item.slug}`) ? "is-active" : ""
                }
                key={item.slug}
              >
                <Link href={`/admin/${item.slug}`}>{item.label}</Link>
              </li>
            ))}
          </ul>
        ) : null}
      </nav>
      <div className="desktop-sidebar__footer">
        <div className="workspace-person">
          <span>{currentUser.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
          <p><strong>{currentUser.name}</strong><small>{currentUser.roles.map((role) => roleLabels[role]).join(" · ")}</small></p>
        </div>
        <Button fullWidth onPress={() => router.push("/request/new")} variant="primary">
          Create request <span aria-hidden="true">+</span>
        </Button>
      </div>
    </aside>
  );
}
