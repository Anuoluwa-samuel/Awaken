import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AchievementCriteria, SkillEffect } from "@/lib/progression/achievements";
import { user } from "./auth";
import {
  attributeEnum,
  categoryEnum,
  challengeStatusEnum,
  completionMethodEnum,
  difficultyEnum,
  focusStatusEnum,
  goalStatusEnum,
  questCadenceEnum,
  questKindEnum,
  questStatusEnum,
  rankEnum,
  xpEventEnum,
} from "./enums";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const userId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ─── Player ──────────────────────────────────────────────────────────────────

export const playerProfile = pgTable(
  "player_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    timeZone: text("time_zone").notNull().default("UTC"),
    dayStartHour: smallint("day_start_hour").notNull().default(4),
    focusAreas: categoryEnum("focus_areas").array().notNull().default(sql`'{}'`),
    preferredDifficulty: difficultyEnum("preferred_difficulty").notNull().default("normal"),
    dailyTarget: smallint("daily_target"),
    avatarUrl: text("avatar_url"),
    equippedTitle: text("equipped_title"),
    /** Listed on the global leaderboard. Off by default for under-18s (see createPlayer). */
    showOnLeaderboard: boolean("show_on_leaderboard").notNull().default(true),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("day_start_hour_range", sql`${t.dayStartHour} between 0 and 23`),
    check("daily_target_range", sql`${t.dailyTarget} is null or ${t.dailyTarget} between 1 and 20`),
  ],
);

/** Cache derived from xp_ledger; verify with SUM(xp_ledger.amount) = total_xp. */
export const playerProgress = pgTable(
  "player_progress",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    totalXp: integer("total_xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    rank: rankEnum("rank").notNull().default("E"),
    skillPointsEarned: integer("skill_points_earned").notNull().default(0),
    skillPointsSpent: integer("skill_points_spent").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("player_progress_total_xp_idx").on(t.totalXp),
    check("total_xp_non_negative", sql`${t.totalXp} >= 0`),
    check("skill_points_balance", sql`${t.skillPointsSpent} <= ${t.skillPointsEarned}`),
  ],
);

export const playerAttribute = pgTable(
  "player_attribute",
  {
    userId: userId(),
    attribute: attributeEnum("attribute").notNull(),
    points: integer("points").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.attribute] })],
);

export const attributeLedger = pgTable(
  "attribute_ledger",
  {
    id: id(),
    userId: userId(),
    attribute: attributeEnum("attribute").notNull(),
    amount: integer("amount").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("attribute_ledger_user_created_idx").on(t.userId, t.createdAt)],
);

// ─── Quests ──────────────────────────────────────────────────────────────────

export const questTemplate = pgTable(
  "quest_template",
  {
    id: id(),
    /** Stable key for system templates (null for player-authored ones). */
    key: text("key").unique(),
    /** null = system template available to every player. */
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: categoryEnum("category").notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    attribute: attributeEnum("attribute").notNull(),
    xpReward: integer("xp_reward"),
    estimatedMinutes: smallint("estimated_minutes"),
    cadence: questCadenceEnum("cadence").notNull(),
    weeklyTarget: smallint("weekly_target"),
    /** Skill code that must be unlocked before this template is offered. */
    requiredSkill: text("required_skill"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("quest_template_owner_idx").on(t.ownerUserId)],
);

/** Which templates feed a player's daily set. */
export const playerQuestSchedule = pgTable(
  "player_quest_schedule",
  {
    userId: userId(),
    templateId: text("template_id")
      .notNull()
      .references(() => questTemplate.id, { onDelete: "cascade" }),
    /** 0 = Sunday … 6 = Saturday; empty = every day. */
    days: smallint("days").array().notNull().default(sql`'{}'`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.templateId] })],
);

export const playerQuest = pgTable(
  "player_quest",
  {
    id: id(),
    userId: userId(),
    templateId: text("template_id").references(() => questTemplate.id, { onDelete: "set null" }),
    kind: questKindEnum("kind").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: categoryEnum("category").notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    attribute: attributeEnum("attribute").notNull(),
    /** Snapshotted at creation; never recalculated afterwards. */
    xpReward: integer("xp_reward").notNull(),
    /** The player's local quest day (see src/lib/time). */
    questDate: date("quest_date", { mode: "string" }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: questStatusEnum("status").notNull().default("available"),
    estimatedMinutes: smallint("estimated_minutes"),
    checklist: jsonb("checklist").$type<{ label: string; done: boolean }[]>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("player_quest_daily_unique").on(t.userId, t.templateId, t.questDate),
    index("player_quest_user_date_idx").on(t.userId, t.questDate),
    index("player_quest_user_status_idx").on(t.userId, t.status),
    check("xp_reward_non_negative", sql`${t.xpReward} >= 0`),
  ],
);

export const questCompletion = pgTable(
  "quest_completion",
  {
    id: id(),
    playerQuestId: text("player_quest_id")
      .notNull()
      .unique()
      .references(() => playerQuest.id, { onDelete: "cascade" }),
    userId: userId(),
    method: completionMethodEnum("method").notNull(),
    evidenceNote: text("evidence_note"),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quest_completion_user_idx").on(t.userId, t.completedAt)],
);

export const weeklyChallenge = pgTable(
  "weekly_challenge",
  {
    id: id(),
    userId: userId(),
    templateId: text("template_id").references(() => questTemplate.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    category: categoryEnum("category").notNull(),
    /** When true, completed quests of any category advance the challenge. */
    countsAnyCategory: boolean("counts_any_category").notNull().default(false),
    target: smallint("target").notNull(),
    progress: smallint("progress").notNull().default(0),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    xpReward: integer("xp_reward").notNull(),
    status: challengeStatusEnum("status").notNull().default("active"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    rewardClaimedAt: timestamp("reward_claimed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("weekly_challenge_unique").on(t.userId, t.templateId, t.weekStart),
    check("weekly_target_positive", sql`${t.target} > 0`),
    check("weekly_progress_range", sql`${t.progress} between 0 and ${t.target}`),
    index("weekly_challenge_user_week_idx").on(t.userId, t.weekStart),
  ],
);

// ─── Rewards ─────────────────────────────────────────────────────────────────

/** Append-only. The auditable source of every XP grant. */
export const xpLedger = pgTable(
  "xp_ledger",
  {
    id: id(),
    userId: userId(),
    eventType: xpEventEnum("event_type").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [
    index("xp_ledger_user_created_idx").on(t.userId, t.createdAt),
    check("xp_amount_sign", sql`${t.amount} >= 0 or ${t.eventType} = 'adjustment'`),
  ],
);

export const levelEvent = pgTable(
  "level_event",
  {
    id: id(),
    userId: userId(),
    fromLevel: integer("from_level").notNull(),
    toLevel: integer("to_level").notNull(),
    fromRank: rankEnum("from_rank").notNull(),
    toRank: rankEnum("to_rank").notNull(),
    ledgerId: text("ledger_id")
      .notNull()
      .unique()
      .references(() => xpLedger.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("level_event_user_idx").on(t.userId, t.createdAt)],
);

// ─── Habits ──────────────────────────────────────────────────────────────────

export const habit = pgTable(
  "habit",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: categoryEnum("category").notNull(),
    attribute: attributeEnum("attribute").notNull(),
    /** 0 = Sunday … 6 = Saturday. Days not listed are rest days. All 7 in weekly-count mode. */
    scheduleDays: smallint("schedule_days").array().notNull(),
    /** When set, the habit is "N times per week" on any days instead of fixed weekdays. */
    timesPerWeek: smallint("times_per_week"),
    /** The player's local date the habit started counting from (streaks never look earlier). */
    startDate: date("start_date", { mode: "string" }).notNull(),
    linkedTemplateId: text("linked_template_id").references(() => questTemplate.id, {
      onDelete: "set null",
    }),
    reminderTime: text("reminder_time"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("habit_user_idx").on(t.userId),
    index("habit_linked_template_idx").on(t.userId, t.linkedTemplateId),
    check("habit_has_schedule", sql`cardinality(${t.scheduleDays}) > 0`),
    check("habit_times_per_week_range", sql`${t.timesPerWeek} is null or ${t.timesPerWeek} between 1 and 7`),
  ],
);

export const habitCompletion = pgTable(
  "habit_completion",
  {
    id: id(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habit.id, { onDelete: "cascade" }),
    userId: userId(),
    localDate: date("local_date", { mode: "string" }).notNull(),
    completedAt: createdAt(),
  },
  (t) => [
    uniqueIndex("habit_completion_unique").on(t.habitId, t.localDate),
    index("habit_completion_user_idx").on(t.userId, t.localDate),
  ],
);

// ─── Skills, achievements, titles ────────────────────────────────────────────

export const skill = pgTable("skill", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  requiredLevel: integer("required_level").notNull().default(1),
  prerequisiteCode: text("prerequisite_code"),
  cost: integer("cost").notNull().default(1),
  /** False while the feature the effect needs doesn't exist yet; such skills can't be unlocked. */
  available: boolean("available").notNull().default(true),
  effect: jsonb("effect").$type<SkillEffect>().notNull(),
});

export const playerSkill = pgTable(
  "player_skill",
  {
    userId: userId(),
    skillCode: text("skill_code")
      .notNull()
      .references(() => skill.code, { onDelete: "cascade" }),
    unlockedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillCode] })],
);

export const achievement = pgTable("achievement", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  criteria: jsonb("criteria").$type<AchievementCriteria>().notNull(),
  xpReward: integer("xp_reward").notNull().default(0),
  titleReward: text("title_reward"),
});

export const playerAchievement = pgTable(
  "player_achievement",
  {
    userId: userId(),
    achievementCode: text("achievement_code")
      .notNull()
      .references(() => achievement.code, { onDelete: "cascade" }),
    unlockedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementCode] })],
);

export const playerTitle = pgTable(
  "player_title",
  {
    userId: userId(),
    title: text("title").notNull(),
    source: text("source").notNull(),
    earnedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.title] })],
);

// ─── Focus & goals ───────────────────────────────────────────────────────────

export const focusSession = pgTable(
  "focus_session",
  {
    id: id(),
    userId: userId(),
    playerQuestId: text("player_quest_id").references(() => playerQuest.id, {
      onDelete: "set null",
    }),
    plannedSeconds: integer("planned_seconds").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    totalPausedSeconds: integer("total_paused_seconds").notNull().default(0),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    status: focusStatusEnum("status").notNull().default("running"),
    /** Focused time actually credited (excludes pauses, capped at planned). */
    creditedSeconds: integer("credited_seconds").notNull().default(0),
    /** The player's quest day the session started on (for stats and caps). */
    startDate: date("start_date", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("focus_session_user_idx").on(t.userId, t.startedAt),
    // At most one running or paused session per player.
    uniqueIndex("focus_session_one_active")
      .on(t.userId)
      .where(sql`${t.status} in ('running', 'paused')`),
    check("planned_seconds_range", sql`${t.plannedSeconds} between 60 and 14400`),
    check("credited_within_planned", sql`${t.creditedSeconds} between 0 and ${t.plannedSeconds}`),
  ],
);

export const goal = pgTable(
  "goal",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: categoryEnum("category").notNull(),
    deadline: date("deadline", { mode: "string" }),
    status: goalStatusEnum("status").notNull().default("active"),
    /** The player's quest day the goal was created (rewards need it to be an earlier day). */
    startDate: date("start_date", { mode: "string" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("goal_user_idx").on(t.userId, t.status)],
);

export const goalMilestone = pgTable(
  "goal_milestone",
  {
    id: id(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goal.id, { onDelete: "cascade" }),
    userId: userId(),
    title: text("title").notNull(),
    position: smallint("position").notNull(),
    playerQuestId: text("player_quest_id").references(() => playerQuest.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("goal_milestone_goal_idx").on(t.goalId, t.position),
    // A quest can stand for at most one milestone.
    uniqueIndex("goal_milestone_quest_unique")
      .on(t.playerQuestId)
      .where(sql`${t.playerQuestId} is not null`),
  ],
);

// ─── Notifications & audit ───────────────────────────────────────────────────

export const notification = pgTable(
  "notification",
  {
    id: id(),
    userId: userId(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    dedupeKey: text("dedupe_key").notNull().unique(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt)],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: id(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_event_actor_idx").on(t.actorUserId, t.createdAt)],
);
