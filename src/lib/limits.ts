// Every usage limit in one place: documented in docs/ARCHITECTURE.md ("Limits and cost controls").
// None of these reduces XP: they stop abuse and runaway costs, not normal play.

/** Per-IP token bucket for dynamic requests, in the proxy. Generous enough for real browsing. */
export const REQUEST_THROTTLE = { capacity: 120, refillPerSecond: 5 } as const;

/** Per-player limit across all server actions (anything that changes data). */
export const ACTION_RATE = { windowSeconds: 60, max: 60 } as const;

/** Per-player creations per UTC day. They stop create-and-cancel loops growing the database. */
export const DAILY_QUOTAS = {
  quests_created: { limit: 50, label: "New quests" },
  habits_created: { limit: 20, label: "New habits" },
  goals_created: { limit: 20, label: "New goals" },
  milestones_added: { limit: 100, label: "New milestones" },
  focus_started: { limit: 60, label: "Focus sessions started" },
  settings_saved: { limit: 30, label: "Settings changes" },
  friend_requests: { limit: 20, label: "Friend requests" },
} as const;
export type QuotaMetric = keyof typeof DAILY_QUOTAS;

/** Account emails per recipient per UTC day, so nobody can flood someone's inbox. */
export const EMAILS_PER_RECIPIENT_PER_DAY = 5;

/** Number of days of usage counters to keep for the admin dashboard. */
export const USAGE_RETENTION_DAYS = 35;

export const quotaMessage = (metric: QuotaMetric) =>
  `You've reached today's limit of ${DAILY_QUOTAS[metric].limit} for ${DAILY_QUOTAS[metric].label.toLowerCase()}. It resets at midnight UTC.`;

export const RATE_LIMITED_MESSAGE = "You're going a little fast. Wait a moment and try again.";

export const utcDay = (now: Date) => now.toISOString().slice(0, 10);
