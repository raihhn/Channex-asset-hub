"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CircleHelp, Command, Plus, Search } from "lucide-react";
import { Button, Input, Popover } from "@heroui/react";
import { useReturnReminders } from "@/components/shared/use-return-reminders";
import { usePrototype } from "@/features/prototype/prototype-provider";

type AppHeaderProps = { pageLabel?: string; showSearch?: boolean };

export function AppHeader({ pageLabel, showSearch = true }: AppHeaderProps) {
  const { currentUser } = usePrototype();
  const router = useRouter();
  const reminders = useReturnReminders();

  function submitSearch(formData: FormData) {
    const query = String(formData.get("global-search") ?? "").trim();
    router.push(query ? `/assets?q=${encodeURIComponent(query)}` : "/assets");
  }

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span aria-hidden="true" className="brand-mark">
          AH
        </span>
        <span>
          <strong>AssetHub</strong>
          <small>{pageLabel ?? "Operations"}</small>
        </span>
      </div>
      <div className="app-header__context">
        {showSearch ? (
          <form action={submitSearch} className="app-header__search">
            <Search aria-hidden="true" size={17} />
            <Input
              aria-label="Search assets and requests"
              name="global-search"
              placeholder="Search assets, requests, events..."
            />
            <kbd>
              <Command size={12} /> K
            </kbd>
          </form>
        ) : null}
        <Button
          aria-label="Help centre"
          className="app-header__utility"
          isIconOnly
          variant="ghost"
        >
          <CircleHelp size={18} />
        </Button>
        <Popover>
          <Button
            aria-label="Operational alerts"
            className={`app-header__utility ${reminders.length ? "app-header__alerts" : ""}`}
            isIconOnly
            variant="ghost"
          >
            <Bell size={18} />
          </Button>
          <Popover.Content placement="bottom end" className="w-80 max-w-full">
            <Popover.Dialog className="space-y-3">
              <Popover.Heading>Return notifications</Popover.Heading>
              {reminders.length ? (
                reminders.map(({ request, tasks }) => (
                  <Link
                    key={request.id}
                    className="border-border block rounded-xl border p-3 text-sm"
                    href={`/requests/${request.id}/return`}
                  >
                    <strong className="line-clamp-2">
                      {request.projectName ?? request.purpose}
                    </strong>
                    <span className="text-muted mt-1 block text-xs">
                      {tasks.length} item(s) ·{" "}
                      {tasks.some((task) => task.overdue)
                        ? "Overdue"
                        : "Due today"}{" "}
                      · {tasks[0].dueAt.replace("T", " ")}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-muted text-sm">
                  No returns due for your account.
                </p>
              )}
              <Link className="text-accent text-xs" href="/requests">
                View all requests →
              </Link>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
        <Button
          className="app-header__new-request"
          onPress={() => router.push("/request/new")}
          variant="primary"
        >
          <Plus size={16} />
          New request
        </Button>
        <Link
          aria-label="View your profile"
          className="profile-token"
          href="/me"
        >
          {currentUser.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </Link>
      </div>
    </header>
  );
}
