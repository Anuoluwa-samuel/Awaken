"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";

/**
 * The desktop sidebar: full width, or icons only. The choice is kept in a cookie so the server
 * renders the right width on the next load, with no jump. Children style themselves for the
 * collapsed state with `group-data-[collapsed=true]:`.
 */
export function CollapsibleSidebar({
  brand,
  defaultCollapsed,
  children,
}: {
  brand: ReactNode;
  defaultCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax${secure}`;
  }

  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "group sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface/60 backdrop-blur transition-[width] duration-200 motion-reduce:transition-none lg:flex",
        collapsed ? "w-[68px] p-2 pt-4" : "w-[260px] p-4",
      )}
    >
      <div className={cn("flex items-center", collapsed ? "flex-col gap-3" : "justify-between gap-2")}>
        {brand}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={label}
          title={label}
          className="grid size-8 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
        >
          <Icon aria-hidden className="size-4" />
        </button>
      </div>
      {children}
    </aside>
  );
}
