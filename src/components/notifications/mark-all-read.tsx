"use client";

import { CheckCheck } from "lucide-react";
import { useTransition } from "react";
import { markAllReadAction } from "@/app/system/notifications/actions";
import { Button } from "@/components/ui/button";

export function MarkAllRead({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={disabled || pending} onClick={() => startTransition(async () => void (await markAllReadAction()))}>
      <CheckCheck aria-hidden /> Mark all read
    </Button>
  );
}
