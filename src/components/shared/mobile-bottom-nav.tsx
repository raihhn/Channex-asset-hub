"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Box, ClipboardList, Home, Plus, User } from "lucide-react";
import { Button } from "@heroui/react";

import { primaryNavigation } from "@/lib/constants/navigation";
import { usePrototypeOptional } from "@/features/prototype/prototype-provider";

const icons = {
  home: Home,
  assets: Box,
  requests: ClipboardList,
};

export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "/";
  const prototype = usePrototypeOptional();
  const role = prototype?.role ?? "Requester";

  return (
    <nav aria-label="Mobile primary navigation" className="mobile-bottom-nav">
      {primaryNavigation.map((item) => (
        <Link
          aria-current={
            currentPath === item.href ||
            (item.href !== "/" && currentPath.startsWith(item.href))
              ? "page"
              : undefined
          }
          className={
            currentPath === item.href ||
            (item.href !== "/" && currentPath.startsWith(item.href))
              ? "is-active"
              : ""
          }
          href={item.href}
          key={item.area}
        >
          {(() => {
            const Icon = icons[item.area];
            return (
              <Icon
                aria-hidden="true"
                className="mobile-bottom-nav__icon"
                size={18}
              />
            );
          })()}
          {item.label}
        </Link>
      ))}
      {role !== "Viewer" ? (
        <Button
          aria-label="New request"
          className="mobile-bottom-nav__new"
          isIconOnly
          onPress={() => router.push("/request/new")}
          variant="primary"
        >
          <Plus size={18} />
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}
      <Link
        aria-label="View your profile"
        className="mobile-bottom-nav__more"
        href="/me"
      >
        <User aria-hidden="true" className="mobile-bottom-nav__icon" size={18} />
        Me
      </Link>
    </nav>
  );
}
