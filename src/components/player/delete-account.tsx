"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

const CONFIRM_WORD = "DELETE";

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Delete account…
      </Button>
    );
  }

  const ready = password.length > 0 && confirm === CONFIRM_WORD && !pending;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    setError(null);
    const { error } = await authClient.deleteUser({ password });
    if (error) {
      setPending(false);
      setError(
        error.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : error.code === "INVALID_PASSWORD"
            ? "That password isn't right."
            : "Your account couldn't be deleted. Try again.",
      );
      return;
    }
    router.replace("/?account=deleted");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormMessage tone="error">
        This permanently deletes your account, quests, habits, goals, focus history, XP, achievements and
        notifications. It can&apos;t be undone.
      </FormMessage>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Field id="delete-password" label="Password">
        <Input
          id="delete-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field id="delete-confirm" label={`Type ${CONFIRM_WORD} to confirm`}>
        <Input
          id="delete-confirm"
          autoComplete="off"
          spellCheck={false}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={!ready}>
          <Trash2 aria-hidden />
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setPassword("");
            setConfirm("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
