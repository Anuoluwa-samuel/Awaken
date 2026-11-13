"use client";

import { useState, useTransition } from "react";
import { requestVerificationAction } from "@/app/system/friends/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { Select } from "@/components/ui/input";

/** Ask one friend to confirm a completed quest. */
export function VerifyRequest({ questId, friends }: { questId: string; friends: { userId: string; name: string }[] }) {
  const [friendId, setFriendId] = useState(friends[0]?.userId ?? "");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await requestVerificationAction({ questId, friendId });
          setMessage(r.ok ? { tone: "success", text: r.message ?? "Request sent." } : { tone: "error", text: r.error });
        });
      }}
    >
      <label htmlFor="verify-friend" className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Ask a friend to confirm
      </label>
      <div className="flex gap-2">
        <Select id="verify-friend" value={friendId} onChange={(e) => setFriendId(e.target.value)}>
          {friends.map((f) => (
            <option key={f.userId} value={f.userId}>
              {f.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" disabled={pending || !friendId}>
          {pending ? "Sending…" : "Ask"}
        </Button>
      </div>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
    </form>
  );
}
