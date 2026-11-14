"use client";

import { Check, Copy, PartyPopper, X } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import {
  addFriendAction,
  answerFriendRequestAction,
  answerVerificationAction,
  cheerAction,
  removeFriendAction,
  type FriendActionResult,
} from "@/app/system/friends/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { playCue } from "@/lib/client/feedback";

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FriendActionResult | null>(null);
  const run = (fn: () => Promise<FriendActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) after?.();
    });
  return { pending, result, run };
}

const Feedback = ({ result }: { result: FriendActionResult | null }) =>
  result && !result.ok ? (
    <p role="alert" className="text-xs text-danger">
      {result.error}
    </p>
  ) : null;

export function FriendCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-md border border-line-strong bg-surface px-3 py-1.5 font-mono text-xl font-semibold tracking-[0.25em] text-glow">
        {code}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked */
          }
        }}
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function AddFriendForm() {
  const [code, setCode] = useState("");
  const { pending, result, run } = useAction();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addFriendAction(code), () => setCode(""));
      }}
    >
      <Field id="friend-code" label="Friend code" hint="Ask a friend for the 8-character code on their Friends page.">
        <div className="flex gap-2">
          <Input
            id="friend-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 7KQ4MZ2P"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            className="font-mono uppercase tracking-[0.2em]"
          />
          <Button type="submit" disabled={pending || code.trim().length === 0}>
            {pending ? "Sending…" : "Add"}
          </Button>
        </div>
      </Field>
      {result?.ok && result.message ? <FormMessage tone="success">{result.message}</FormMessage> : null}
      {result && !result.ok ? <FormMessage tone="error">{result.error}</FormMessage> : null}
    </form>
  );
}

export function RequestButtons({ id }: { id: string }) {
  const { pending, result, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <Button size="sm" disabled={pending} onClick={() => run(() => answerFriendRequestAction({ id, accept: true }))}>
          Accept
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => answerFriendRequestAction({ id, accept: false }))}>
          Decline
        </Button>
      </div>
      <Feedback result={result} />
    </div>
  );
}

export function RemoveButton({ id, label, children }: { id: string; label: string; children?: ReactNode }) {
  const [confirm, setConfirm] = useState(false);
  const { pending, result, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      {confirm ? (
        <div className="flex gap-1.5">
          <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => removeFriendAction(id))}>
            {children ?? "Remove"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <Button size="icon" variant="ghost" aria-label={label} onClick={() => setConfirm(true)}>
          <X />
        </Button>
      )}
      <Feedback result={result} />
    </div>
  );
}

export function CheerButton({ id, cheered, cheers }: { id: string; cheered: boolean; cheers: number }) {
  const { pending, result, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={cheered ? "ghost" : "outline"}
        disabled={cheered || pending}
        onClick={() => run(() => cheerAction(id), () => playCue("complete"))}
        aria-pressed={cheered}
      >
        <PartyPopper className={cheered ? "text-success" : undefined} />
        {cheered ? "Cheered" : "Cheer"}
        {cheers > 0 ? <span className="font-mono text-ink-muted">{cheers}</span> : null}
      </Button>
      <Feedback result={result} />
    </div>
  );
}

export function VerificationButtons({ id }: { id: string }) {
  const { pending, result, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <Button size="sm" disabled={pending} onClick={() => run(() => answerVerificationAction({ id, confirm: true }))}>
          <Check /> Confirm
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => answerVerificationAction({ id, confirm: false }))}>
          Can&apos;t confirm
        </Button>
      </div>
      <Feedback result={result} />
    </div>
  );
}
