import { initBotId } from "botid/client/core";
import { BOTID_PROTECTED, botIdEnabled } from "@/lib/auth/bot-protection";

// Attaches Vercel BotID's challenge headers to the protected auth requests. Off by default;
// see docs/DEPLOYMENT.md ("Bot protection") before turning it on.
if (botIdEnabled) initBotId({ protect: [...BOTID_PROTECTED] });
