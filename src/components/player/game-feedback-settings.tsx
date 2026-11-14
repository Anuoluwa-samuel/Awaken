"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { disablePushAction, enablePushAction } from "@/app/system/settings/actions";
import { Button } from "@/components/ui/button";
import { playCue, setSoundEnabled, soundEnabled } from "@/lib/client/feedback";

const noop = () => () => {};

/** Sound effects for completions, level-ups and ranks. Off by default; remembered per browser. */
export function SoundToggle() {
  const initial = useSyncExternalStore(noop, soundEnabled, () => false);
  const [on, setOn] = useState<boolean | null>(null);
  const value = on ?? initial;
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Sound effects</p>
        <p className="text-xs text-ink-faint">Short tones when you complete quests, level up or rank up. This browser only.</p>
      </div>
      <Button
        variant={value ? "primary" : "outline"}
        size="sm"
        role="switch"
        aria-checked={value}
        onClick={() => {
          setSoundEnabled(!value);
          setOn(!value);
          if (!value) playCue("complete", true);
        }}
      >
        {value ? "On" : "Off"}
      </Button>
    </div>
  );
}

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

type PushState = "loading" | "unsupported" | "blocked" | "off" | "on";

/**
 * The evening reminder: one push notification at 7pm local time, only on days with quests left.
 * Hidden when the site has no push keys configured.
 */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: PushState;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) next = "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        next = (await reg?.pushManager.getSubscription()) ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "blocked" : "off");
      return;
    }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) });
    const r = await enablePushAction(sub.toJSON());
    if (!r.ok) {
      await sub.unsubscribe();
      throw new Error(r.error);
    }
    setState("on");
  }

  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await disablePushAction(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  const hint =
    state === "unsupported"
      ? "This browser can't receive push notifications. On iPhone, add AWAKEN to your Home Screen first."
      : state === "blocked"
        ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again."
        : "At most one a day, around 7pm your time, and only when quests are still open. This browser only.";

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Evening reminder</p>
          <p className="text-xs text-ink-faint">{hint}</p>
        </div>
        {state === "on" || state === "off" ? (
          <Button
            variant={state === "on" ? "primary" : "outline"}
            size="sm"
            role="switch"
            aria-checked={state === "on"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await (state === "on" ? disable() : enable());
              } catch (e) {
                setError((e as Error).message || "Couldn't change the reminder. Try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {state === "on" ? "On" : "Off"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
