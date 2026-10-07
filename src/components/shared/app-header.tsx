"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CircleHelp, Command, Plus, Search } from "lucide-react";
import { Button, Input } from "@heroui/react";
import { usePrototype } from "@/features/prototype/prototype-provider";

type AppHeaderProps = { pageLabel?: string };

export function AppHeader({ pageLabel }: AppHeaderProps) {
  const { currentUser } = usePrototype();
  const router = useRouter();

  function submitSearch(formData: FormData) {
    const query = String(formData.get("global-search") ?? "").trim();
    router.push(query ? `/assets?q=${encodeURIComponent(query)}` : "/assets");
  }

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span aria-hidden="true" className="brand-mark">AH</span>
        <span><strong>AssetHub</strong><small>{pageLabel ?? "Operations"}</small></span>
      </div>
      <div className="app-header__context">
        <form action={submitSearch} className="app-header__search">
          <Search aria-hidden="true" size={17} />
          <Input aria-label="Search assets and requests" name="global-search" placeholder="Search assets, requests, events..." />
          <kbd><Command size={12} /> K</kbd>
        </form>
        <Button aria-label="Help centre" className="app-header__utility" isIconOnly variant="ghost">
          <CircleHelp size={18} />
        </Button>
        <Button
          aria-label="Operational alerts"
          className="app-header__utility app-header__alerts"
          isIconOnly
          variant="ghost"
        >
          <Bell size={18} />
        </Button>
        <Button
          className="app-header__new-request"
          onPress={() => router.push("/request/new")}
          variant="primary"
        >
          <Plus size={16} />
          New request
        </Button>
        <Link aria-label="View your profile" className="profile-token" href="/me">{currentUser.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</Link>
      </div>
    </header>
  );
}
