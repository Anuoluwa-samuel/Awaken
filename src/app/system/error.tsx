"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function SystemError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Panel className="mx-auto max-w-lg p-8 text-center">
      <TriangleAlert aria-hidden className="mx-auto size-8 text-warning" />
      <h1 className="mt-3 font-display text-xl font-semibold">System error</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Something went wrong loading this window. Your progress is safe — nothing was lost.
      </p>
      <Button className="mt-6" variant="outline" onClick={reset}>
        Try again
      </Button>
    </Panel>
  );
}
