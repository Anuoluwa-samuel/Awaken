import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_THROTTLE } from "@/lib/limits";
import { createThrottle } from "@/lib/throttle";

const take = createThrottle(REQUEST_THROTTLE);

const PROTECTED = /^\/(system|onboarding|admin)(\/|$)/;

/** Same source of the client IP as Better Auth's limits. See docs/DEPLOYMENT.md. */
function clientIp(request: NextRequest) {
  const header = process.env.VERCEL ? "x-vercel-forwarded-for" : process.env.AUTH_IP_HEADER || "x-forwarded-for";
  return request.headers.get(header)?.split(",")[0]?.trim() || "unknown";
}

export function proxy(request: NextRequest) {
  const { allowed, retryAfterSeconds } = take(clientIp(request));
  if (!allowed) {
    return new NextResponse("Too many requests. Please slow down and try again shortly.", {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds), "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  // Optimistic check only: real authorization happens in every page and action
  // via src/lib/auth/session.ts.
  if (PROTECTED.test(request.nextUrl.pathname) && !getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Dynamic routes only. Prerendered pages (home, guide, legal) and static files come from Vercel's
// CDN, where they cost almost nothing, so running code for them would add cost rather than save it.
export const config = {
  matcher: [
    "/system/:path*",
    "/onboarding",
    "/admin/:path*",
    "/api/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ],
};
