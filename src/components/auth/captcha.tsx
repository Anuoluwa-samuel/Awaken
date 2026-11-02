"use client";

import { useEffect, useRef } from "react";
import { CAPTCHA_HEADER } from "@/lib/auth/captcha";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** True when the captcha is switched on for this deployment. */
export const captchaEnabled = !!siteKey;

/** Options for an auth client call that carry the captcha token, when there is one. */
export const captchaFetchOptions = (token: string | null) =>
  token ? { fetchOptions: { headers: { [CAPTCHA_HEADER]: token } } } : {};

function loadScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.append(script);
    }
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("captcha script failed")), { once: true });
  });
}

/**
 * The Cloudflare Turnstile widget. Renders nothing unless captcha is on. Tokens work once, so change
 * `resetKey` after any failed submit to get a new one.
 */
export function Captcha({ onToken, resetKey = 0 }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey) return;
    let widgetId: string | undefined;
    let cancelled = false;
    callback.current(null);
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        });
      })
      .catch((err) => console.warn(err));
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={container} className="min-h-[65px]" />;
}
