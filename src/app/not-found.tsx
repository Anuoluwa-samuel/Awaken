import { Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

// Shown for unknown routes and for records the signed-in player doesn't own — the two are
// deliberately indistinguishable.
export default function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <Panel className="max-w-md p-8 text-center">
        <Compass aria-hidden className="mx-auto size-8 text-glow" />
        <p className="mt-3 font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-glow">404</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-wide">Nothing here</h1>
        <p className="mt-2 text-sm text-ink-muted">The System has no record at this address.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/system">Back to status</Link>
        </Button>
      </Panel>
    </div>
  );
}
