// Single source of truth for progression numbers. Documented in docs/ARCHITECTURE.md §3–5.
// Pure data only: imported by the DB schema, server services, and UI.

export const ATTRIBUTES = [
  "strength",
  "intelligence",
  "discipline",
  "vitality",
  "creativity",
] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const ATTRIBUTE_INFO: Record<Attribute, { label: string; short: string; blurb: string }> = {
  strength: { label: "Strength", short: "STR", blurb: "Physical activity and fitness" },
  intelligence: { label: "Intelligence", short: "INT", blurb: "Learning, study and skill development" },
  discipline: { label: "Discipline", short: "DIS", blurb: "Consistency and finishing what you plan" },
  vitality: { label: "Vitality", short: "VIT", blurb: "Sustainable routines and recovery" },
  creativity: { label: "Creativity", short: "CRE", blurb: "Writing, building, design and creative output" },
};

export const CATEGORIES = [
  "fitness",
  "learning",
  "career",
  "creativity",
  "finance",
  "organization",
  "social",
  "wellbeing",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_INFO: Record<Category, { label: string; attribute: Attribute }> = {
  fitness: { label: "Physical fitness", attribute: "strength" },
  learning: { label: "Learning", attribute: "intelligence" },
  career: { label: "Career", attribute: "intelligence" },
  creativity: { label: "Creativity", attribute: "creativity" },
  finance: { label: "Financial discipline", attribute: "discipline" },
  organization: { label: "Personal organization", attribute: "discipline" },
  social: { label: "Social connection", attribute: "vitality" },
  wellbeing: { label: "Mental wellbeing", attribute: "vitality" },
};

export const DIFFICULTIES = ["easy", "normal", "hard", "elite"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_XP: Record<Difficulty, number> = {
  easy: 10,
  normal: 25,
  hard: 50,
  elite: 100,
};

export const DIFFICULTY_ATTRIBUTE_POINTS: Record<Difficulty, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
  elite: 5,
};

/** Custom XP may not go below this, nor above CUSTOM_XP_MAX_MULTIPLIER × the difficulty default. */
export const CUSTOM_XP_MIN = 5;
export const CUSTOM_XP_MAX_MULTIPLIER = 2;

export const LEVEL_CURVE = { base: 100, increment: 20 } as const;

export const LIMITS = {
  /** Quest + focus XP per player day. Achievements and weekly challenges are not capped. */
  dailyQuestXpCap: 400,
  /** Attribute points per attribute per player day. */
  dailyAttributeCap: 10,
  /** Rewarded custom-quest completions per category per player day. */
  customCompletionsPerCategoryPerDay: 3,
  /** Discipline bonus for finishing a scheduled daily quest on its day. */
  dailyQuestDisciplineBonus: 1,
  /** Skill points granted per level gained. */
  skillPointsPerLevel: 1,
} as const;

export const RANKS = [
  { id: "E", label: "E-Rank", minLevel: 1 },
  { id: "D", label: "D-Rank", minLevel: 10 },
  { id: "C", label: "C-Rank", minLevel: 20 },
  { id: "B", label: "B-Rank", minLevel: 35 },
  { id: "A", label: "A-Rank", minLevel: 50 },
  { id: "S", label: "S-Rank", minLevel: 70 },
  { id: "N", label: "National-Level", minLevel: 90 },
] as const;
export type RankId = (typeof RANKS)[number]["id"];

export const DEFAULT_DAY_START_HOUR = 4;
export const RANK_IDS = ["E", "D", "C", "B", "A", "S", "N"] as const satisfies readonly RankId[];

export const QUEST_LIMITS = {
  /** Open (available / in progress) one-off custom quests per player. */
  maxOpenCustomQuests: 30,
  /** Active recurring custom quests per player. */
  maxRecurringCustomQuests: 10,
  maxChecklistItems: 12,
  maxTitleLength: 80,
  maxDescriptionLength: 500,
  maxEvidenceLength: 500,
} as const;

/** Weekly challenge reward = this multiple of the difficulty default (uncapped). */
export const WEEKLY_XP_MULTIPLIER = 2;
