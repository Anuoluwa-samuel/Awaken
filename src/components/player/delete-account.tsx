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
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Delete account…
      </Button>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    // The button stays clickable and explains what's missing: a silently disabled one reads as broken.
    const missing = {
      password: password ? undefined : "Enter your password.",
      confirm: confirm.trim().toUpperCase() === CONFIRM_WORD ? undefined : `Type ${CONFIRM_WORD} to confirm.`,
    };
    setFieldErrors(missing);
    setError(null);
    if (missing.password || missing.confirm) return;

    setPending(true);
    try {
      const { error } = await authClient.deleteUser({ password });
      if (error) {
        setError(
          error.status === 429
            ? "Too many attempts. Wait a few minutes and try again."
            : error.code === "INVALID_PASSWORD"
              ? "That password isn't right."
              : "Your account couldn't be deleted. Try again.",
        );
        setPending(false);
        return;
      }
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setPending(false);
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
      <Field id="delete-password" label="Password" error={fieldErrors.password}>
        <Input
          id="delete-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!fieldErrors.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field id="delete-confirm" label={`Type ${CONFIRM_WORD} to confirm`} error={fieldErrors.confirm}>
        <Input
          id="delete-confirm"
          autoComplete="off"
          aria-invalid={!!fieldErrors.confirm}
          spellCheck={false}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
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
            setFieldErrors({});
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
