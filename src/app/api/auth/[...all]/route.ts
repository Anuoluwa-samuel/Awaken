import { toNextJsHandler } from "better-auth/next-js";
import { checkBotId } from "botid/server";
import { BOTID_PROTECTED, botIdEnabled } from "@/lib/auth/bot-protection";
import { auth } from "@/lib/auth/server";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: Request) {
  const path = new URL(request.url).pathname;
  if (botIdEnabled && BOTID_PROTECTED.some((route) => route.path === path)) {
    // Off Vercel (local dev, E2E) BotID can't classify requests, so treat them as human.
    const { isBot } = await checkBotId({ developmentOptions: { isDevelopment: !process.env.VERCEL } });
    if (isBot) {
      return Response.json(
        { code: "BOT_DETECTED", message: "Your browser didn't pass our automated-traffic check. Reload and try again." },
        { status: 403 },
      );
    }
  }
  return handler.POST(request);
}
