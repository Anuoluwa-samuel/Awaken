import { pgEnum } from "drizzle-orm/pg-core";
import {
  ATTRIBUTES,
  CATEGORIES,
  DIFFICULTIES,
  RANK_IDS,
} from "@/lib/progression/config";

export const attributeEnum = pgEnum("attribute", ATTRIBUTES);
export const categoryEnum = pgEnum("category", CATEGORIES);
export const difficultyEnum = pgEnum("difficulty", DIFFICULTIES);
export const rankEnum = pgEnum("rank", RANK_IDS);

export const questKindEnum = pgEnum("quest_kind", ["daily", "weekly", "custom"]);
export const questCadenceEnum = pgEnum("quest_cadence", ["daily", "weekly", "once"]);
export const questStatusEnum = pgEnum("quest_status", [
  "available",
  "in_progress",
  "completed",
  "expired",
  "cancelled",
]);
export const completionMethodEnum = pgEnum("completion_method", [
  "self_reported",
  "focus_session",
  "habit",
  "integration",
]);
export const challengeStatusEnum = pgEnum("challenge_status", [
  "active",
  "completed",
  "expired",
]);
export const xpEventEnum = pgEnum("xp_event", [
  "quest_completed",
  "habit_completed",
  "weekly_completed",
  "achievement_unlocked",
  "focus_completed",
  "goal_completed",
  /** Extra rewards: daily combo, boss quests, system events, friend-verified quests. */
  "bonus",
  "adjustment",
]);
export const focusStatusEnum = pgEnum("focus_status", [
  "running",
  "paused",
  "completed",
  "abandoned",
]);
export const goalStatusEnum = pgEnum("goal_status", ["active", "completed", "archived"]);
export const friendshipStatusEnum = pgEnum("friendship_status", ["pending", "accepted"]);
export const verificationStatusEnum = pgEnum("verification_status", ["pending", "confirmed", "declined"]);
