"use client";

import { Lock, Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string) {
  return href === "/system" ? pathname === href : pathname.startsWith(href);
}

export function SidebarNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="grid gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon, lockedUntil }) => {
        if (lockedUntil) {
          return (
            <span
              key={href}
              aria-disabled
              title={`Unlocks in a later build`}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-faint/70"
            >
              <Icon aria-hidden className="size-4" />
              <span className="flex-1">{label}</span>
              <Lock aria-label="Not yet available" className="size-3" />
            </span>
          );
        }
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-glow-soft text-ink" : "text-ink-muted hover:bg-panel-raised hover:text-ink",
            )}
          >
            {active ? <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded bg-glow shadow-[0_0_8px_#4f9dff]" /> : null}
            <Icon aria-hidden className={cn("size-4", active && "text-glow")} />
            <span className="flex-1">{label}</span>
            {href === "/system/notifications" && unread > 0 ? (
              <span className="rounded bg-glow px-1.5 font-mono text-[11px] font-semibold text-bg">{unread}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.filter((i) => i.mobile).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-glow" : "text-ink-muted",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {label}
                {href === "/system/notifications" && unread > 0 ? (
                  <span className="absolute right-1/2 top-1.5 translate-x-4 rounded-full bg-glow px-1 font-mono text-[10px] text-bg">
                    {unread}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
        <li>
          <MobileMenu unread={unread} />
        </li>
      </ul>
    </nav>
  );
}

/** Bottom sheet with every section, so nothing is unreachable on small screens. */
function MobileMenu({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-ink-muted">
        <Menu aria-hidden className="size-5" />
        Menu
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 animate-rise rounded-t-2xl border-t border-line-strong bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-panel">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">
              System menu
            </Dialog.Title>
            <Dialog.Close aria-label="Close menu" className="rounded p-1 text-ink-muted hover:text-ink">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">All sections of AWAKEN</Dialog.Description>
          <div onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
            <SidebarNav unread={unread} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
