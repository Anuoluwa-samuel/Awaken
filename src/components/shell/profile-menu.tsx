"use client";

import { ChartColumn, LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { authClient } from "@/lib/auth/client";

export function ProfileMenu({ name, initials, isAdmin }: { name: string; initials: string; isAdmin: boolean }) {
  const router = useRouter();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`${initials} — player menu for ${name}`}
        className="grid size-9 place-items-center rounded-md border border-line-strong bg-panel-raised font-display text-sm font-bold text-glow hover:shadow-glow"
      >
        {initials}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-48 animate-rise rounded-md border border-line-strong bg-panel p-1 shadow-panel"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs text-ink-faint">
            Signed in as <span className="text-ink">{name}</span>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-panel-raised">
            <Link href="/system/profile">
              <User aria-hidden className="size-4" /> Profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-panel-raised">
            <Link href="/system/settings">
              <Settings aria-hidden className="size-4" /> Settings
            </Link>
          </DropdownMenu.Item>
          {isAdmin ? (
            <DropdownMenu.Item asChild className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-panel-raised">
              <Link href="/admin">
                <ChartColumn aria-hidden className="size-4" /> Admin dashboard
              </Link>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-danger outline-none data-[highlighted]:bg-danger/10"
            onSelect={async () => {
              await authClient.signOut();
              router.replace("/");
              router.refresh();
            }}
          >
            <LogOut aria-hidden className="size-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
