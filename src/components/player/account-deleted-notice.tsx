"use client";

import { useSearchParams } from "next/navigation";
import { FormMessage } from "@/components/ui/field";

/** Confirmation after self-serve deletion, which lands on /?account=deleted. */
export function AccountDeletedNotice() {
  const params = useSearchParams();
  if (params.get("account") !== "deleted") return null;
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <FormMessage tone="success">Your account and all its data have been deleted.</FormMessage>
    </div>
  );
}
