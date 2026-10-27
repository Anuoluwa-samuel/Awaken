import type { Attribute, Category, Difficulty } from "@/lib/progression/config";

// Reference data loaded by `pnpm db:seed` (idempotent upserts keyed by `key`/`code`).

export type SystemTemplate = {
  key: string;
  title: string;
  description: string;
  category: Category;
  difficulty: Difficulty;
  attribute: Attribute;
  estimatedMinutes?: number;
  cadence: "daily" | "weekly";
  weeklyTarget?: number;
  /** Weekly only: any completed quest counts, not just this category. */
  weeklyAnyCategory?: boolean;
  /** Weekly only: assigned to every player regardless of focus areas. */
  weeklyDefault?: boolean;
  /** Offered as a starter quest when the player picks this focus area. */
  starter?: boolean;
};

export const SYSTEM_QUEST_TEMPLATES: SystemTemplate[] = [
  // Daily
  { key: "daily.review-priorities", title: "Review your daily priorities", description: "Pick the one to three things that would make today a win.", category: "organization", difficulty: "easy", attribute: "discipline", estimatedMinutes: 5, cadence: "daily", starter: true },
  { key: "daily.workout", title: "Complete a workout", description: "Any session that raises your heart rate — walk, run, lift, swim, dance.", category: "fitness", difficulty: "normal", attribute: "strength", estimatedMinutes: 30, cadence: "daily", starter: true },
  { key: "daily.stretch", title: "Stretch or mobility for 10 minutes", description: "Gentle movement counts. Rest days are part of training.", category: "fitness", difficulty: "easy", attribute: "vitality", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.study-30", title: "Read or study for 30 minutes", description: "Books, courses, documentation, papers — focused learning time.", category: "learning", difficulty: "normal", attribute: "intelligence", estimatedMinutes: 30, cadence: "daily", starter: true },
  { key: "daily.skill-45", title: "Practice a skill for 45 minutes", description: "Deliberate practice on something you are getting better at.", category: "career", difficulty: "hard", attribute: "intelligence", estimatedMinutes: 45, cadence: "daily", starter: true },
  { key: "daily.write-300", title: "Write 300 words", description: "Journal, draft, blog, fiction — anything you wrote yourself.", category: "creativity", difficulty: "normal", attribute: "creativity", estimatedMinutes: 20, cadence: "daily", starter: true },
  { key: "daily.track-spending", title: "Log today's spending", description: "Record what went out today. Awareness first, judgement never.", category: "finance", difficulty: "easy", attribute: "discipline", estimatedMinutes: 5, cadence: "daily", starter: true },
  { key: "daily.workspace", title: "Reset your workspace", description: "Ten minutes to clear the desk and close loose ends.", category: "organization", difficulty: "easy", attribute: "discipline", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.reach-out", title: "Reach out to someone", description: "Message, call or meet a friend, relative or colleague.", category: "social", difficulty: "easy", attribute: "vitality", estimatedMinutes: 10, cadence: "daily", starter: true },
  { key: "daily.wind-down", title: "Take a screen-free wind-down", description: "Twenty minutes offline before sleep — read, breathe, reflect.", category: "wellbeing", difficulty: "easy", attribute: "vitality", estimatedMinutes: 20, cadence: "daily", starter: true },
  // Weekly
  { key: "weekly.study-4", title: "Complete four study sessions", description: "Four learning quests this week.", category: "learning", difficulty: "hard", attribute: "intelligence", cadence: "weekly", weeklyTarget: 4 },
  { key: "weekly.workout-3", title: "Finish three workouts", description: "Three fitness quests this week.", category: "fitness", difficulty: "hard", attribute: "strength", cadence: "weekly", weeklyTarget: 3 },
  { key: "weekly.tasks-5", title: "Complete five planned tasks", description: "Finish any five quests this week.", category: "organization", difficulty: "hard", attribute: "discipline", cadence: "weekly", weeklyTarget: 5, weeklyAnyCategory: true, weeklyDefault: true },
];

export const SKILLS = [
  { code: "early-bird", name: "Early Bird", description: "Unlocks a morning-routine quest template.", category: "routine", requiredLevel: 3, prerequisiteCode: null, cost: 1 },
  { code: "deep-focus", name: "Deep Focus", description: "Unlocks 50- and 90-minute focus sessions.", category: "focus", requiredLevel: 5, prerequisiteCode: null, cost: 1 },
  { code: "consistency", name: "Consistency", description: "Unlocks extra habit insights on the progress page.", category: "habits", requiredLevel: 8, prerequisiteCode: null, cost: 1 },
  { code: "quick-learner", name: "Quick Learner", description: "Unlocks advanced learning challenge templates.", category: "learning", requiredLevel: 10, prerequisiteCode: "deep-focus", cost: 2 },
  { code: "creator", name: "Creator", description: "Unlocks project-based quest templates.", category: "creativity", requiredLevel: 12, prerequisiteCode: "deep-focus", cost: 2 },
] as const;

export const ACHIEVEMENTS = [
  { code: "first-blood", name: "First Blood", description: "Complete your first quest.", icon: "swords", criteria: { type: "quests_completed", threshold: 1 }, xpReward: 10, titleReward: null },
  { code: "awakening", name: "Awakening", description: "Reach level 5.", icon: "sparkles", criteria: { type: "level", threshold: 5 }, xpReward: 0, titleReward: "The Awakened" },
  { code: "unstoppable", name: "Unstoppable", description: "Keep a habit streak for 14 scheduled days.", icon: "flame", criteria: { type: "habit_streak", threshold: 14 }, xpReward: 50, titleReward: "Unstoppable" },
  { code: "scholar", name: "Scholar", description: "Complete 25 learning quests.", icon: "book-open", criteria: { type: "category_quests", threshold: 25, category: "learning" }, xpReward: 50, titleReward: "Scholar" },
  { code: "creator", name: "Creator", description: "Complete 25 creativity quests.", icon: "palette", criteria: { type: "category_quests", threshold: 25, category: "creativity" }, xpReward: 50, titleReward: "Creator" },
  { code: "consistent", name: "Consistent", description: "Complete a weekly challenge.", icon: "calendar-check", criteria: { type: "weekly_completed", threshold: 1 }, xpReward: 25, titleReward: null },
  { code: "elite", name: "Elite", description: "Reach level 35 (B-Rank).", icon: "crown", criteria: { type: "level", threshold: 35 }, xpReward: 0, titleReward: "Elite Hunter" },
] as const;
