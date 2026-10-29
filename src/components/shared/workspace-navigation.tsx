"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ClipboardList, ListTodo, Settings2 } from "lucide-react";

const items = [
  { href: "/", label: "Today", icon: ListTodo },
  { href: "/assets", label: "Inventory", icon: Boxes },
  { href: "/requests", label: "Requests", icon: ClipboardList },
  { href: "/operations", label: "Operations", icon: Settings2 },
];

export function WorkspaceNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="workspace-navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return <Link aria-current={active ? "page" : undefined} className={active ? "is-active" : ""} href={item.href} key={item.href}><Icon size={16} />{item.label}</Link>;
      })}
    </nav>
  );
}
