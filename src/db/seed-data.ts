import type { AchievementCriteria, SkillEffect } from "@/lib/progression/achievements";
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
  /** Only offered once the player has unlocked this skill. */
  requiredSkill?: string;
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
  // Skill-gated (scheduled when the skill is unlocked)
  { key: "daily.morning-routine", title: "Complete your morning routine", description: "Wake, water, move, plan — however your morning looks.", category: "wellbeing", difficulty: "easy", attribute: "vitality", estimatedMinutes: 20, cadence: "daily", requiredSkill: "early-bird" },
  { key: "daily.build-45", title: "Build something for 45 minutes", description: "Make progress on a project you can show someone.", category: "creativity", difficulty: "hard", attribute: "creativity", estimatedMinutes: 45, cadence: "daily", requiredSkill: "creator" },
  // Weekly
  { key: "weekly.study-4", title: "Complete four study sessions", description: "Four learning quests this week.", category: "learning", difficulty: "hard", attribute: "intelligence", cadence: "weekly", weeklyTarget: 4 },
  { key: "weekly.workout-3", title: "Finish three workouts", description: "Three fitness quests this week.", category: "fitness", difficulty: "hard", attribute: "strength", cadence: "weekly", weeklyTarget: 3 },
  { key: "weekly.tasks-5", title: "Complete five planned tasks", description: "Finish any five quests this week.", category: "organization", difficulty: "hard", attribute: "discipline", cadence: "weekly", weeklyTarget: 5, weeklyAnyCategory: true, weeklyDefault: true },
  { key: "weekly.advanced-study", title: "Advanced study block", description: "Six learning quests this week.", category: "learning", difficulty: "elite", attribute: "intelligence", cadence: "weekly", weeklyTarget: 6, requiredSkill: "quick-learner" },
];

export type SkillSeed = {
  code: string;
  name: string;
  description: string;
  category: string;
  requiredLevel: number;
  prerequisiteCode: string | null;
  cost: number;
  available: boolean;
  effect: SkillEffect;
};

// Prerequisites form a small tree: Early Bird → (Consistency → Creator, Quick Learner).
export const SKILLS: SkillSeed[] = [
  { code: "early-bird", name: "Early Bird", description: "Adds a morning-routine daily quest.", category: "routine", requiredLevel: 3, prerequisiteCode: null, cost: 1, available: true, effect: { type: "daily_template", templateKey: "daily.morning-routine" } },
  { code: "consistency", name: "Consistency", description: "Adds weekday insights to every habit.", category: "habits", requiredLevel: 5, prerequisiteCode: "early-bird", cost: 1, available: true, effect: { type: "habit_insights" } },
  { code: "deep-focus", name: "Deep Focus", description: "Unlocks 50- and 90-minute focus sessions.", category: "focus", requiredLevel: 5, prerequisiteCode: null, cost: 1, available: true, effect: { type: "focus_lengths", minutes: [50, 90] } },
  { code: "quick-learner", name: "Quick Learner", description: "Adds an advanced weekly study challenge.", category: "learning", requiredLevel: 8, prerequisiteCode: "early-bird", cost: 2, available: true, effect: { type: "weekly_template", templateKey: "weekly.advanced-study" } },
  { code: "creator", name: "Creator", description: "Adds a daily project-building quest.", category: "creativity", requiredLevel: 10, prerequisiteCode: "consistency", cost: 2, available: true, effect: { type: "daily_template", templateKey: "daily.build-45" } },
];

export type AchievementSeed = {
  code: string;
  name: string;
  description: string;
  icon: string;
  criteria: AchievementCriteria;
  xpReward: number;
  titleReward: string | null;
};

export const ACHIEVEMENTS: AchievementSeed[] = [
  { code: "first-blood", name: "First Blood", description: "Complete your first quest.", icon: "swords", criteria: { type: "quests_completed", threshold: 1 }, xpReward: 10, titleReward: null },
  { code: "awakening", name: "Awakening", description: "Reach level 5.", icon: "sparkles", criteria: { type: "level", threshold: 5 }, xpReward: 0, titleReward: "The Awakened" },
  { code: "routine", name: "Routine", description: "Check in on habits 10 times.", icon: "repeat", criteria: { type: "habit_checkins", threshold: 10 }, xpReward: 25, titleReward: null },
  { code: "unstoppable", name: "Unstoppable", description: "Keep a habit streak for 14 scheduled days.", icon: "flame", criteria: { type: "habit_streak", threshold: 14 }, xpReward: 50, titleReward: "Unstoppable" },
  { code: "consistent", name: "Consistent", description: "Complete a weekly challenge.", icon: "calendar-check", criteria: { type: "weekly_completed", threshold: 1 }, xpReward: 25, titleReward: null },
  { code: "skilled", name: "Skilled", description: "Unlock your first skill.", icon: "git-branch", criteria: { type: "skills_unlocked", threshold: 1 }, xpReward: 10, titleReward: null },
  { code: "flow-state", name: "Flow State", description: "Complete 10 full focus sessions.", icon: "timer", criteria: { type: "focus_sessions", threshold: 10 }, xpReward: 25, titleReward: null },
  { code: "finisher", name: "Finisher", description: "Complete a goal.", icon: "flag", criteria: { type: "goals_completed", threshold: 1 }, xpReward: 25, titleReward: "Finisher" },
  { code: "rising", name: "Rising Hunter", description: "Reach D-Rank (level 10).", icon: "chevrons-up", criteria: { type: "level", threshold: 10 }, xpReward: 0, titleReward: "Rising Hunter" },
  { code: "scholar", name: "Scholar", description: "Complete 25 learning quests.", icon: "book-open", criteria: { type: "category_quests", threshold: 25, category: "learning" }, xpReward: 50, titleReward: "Scholar" },
  { code: "creator", name: "Creator", description: "Complete 25 creativity quests.", icon: "palette", criteria: { type: "category_quests", threshold: 25, category: "creativity" }, xpReward: 50, titleReward: "Creator" },
  { code: "elite", name: "Elite", description: "Reach level 35 (B-Rank).", icon: "crown", criteria: { type: "level", threshold: 35 }, xpReward: 0, titleReward: "Elite Hunter" },
];
