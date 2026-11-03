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
  // The rotation pool: any of these can appear on a given day (src/lib/progression/daily-rotation.ts).
  { key: "daily.walk-20", title: "Take a 20-minute walk", description: "Outside if you can. No pace to hit, just keep moving.", category: "fitness", difficulty: "easy", attribute: "vitality", estimatedMinutes: 20, cadence: "daily" },
  { key: "daily.bodyweight-15", title: "Do a 15-minute bodyweight session", description: "Squats, push-ups, planks: scale them to suit you.", category: "fitness", difficulty: "normal", attribute: "strength", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.cardio-30", title: "Get 30 minutes of cardio", description: "Run, cycle, swim, dance or skip. Anything that lifts your heart rate.", category: "fitness", difficulty: "normal", attribute: "strength", estimatedMinutes: 30, cadence: "daily" },
  { key: "daily.strength-45", title: "Train strength for 45 minutes", description: "A full session with weights, bands or your own bodyweight.", category: "fitness", difficulty: "hard", attribute: "strength", estimatedMinutes: 45, cadence: "daily" },
  { key: "daily.new-exercise", title: "Learn one new exercise", description: "Find a guide and practise the form with light effort.", category: "fitness", difficulty: "easy", attribute: "strength", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.stairs", title: "Choose the active option all day", description: "Stairs over lifts, walking over short rides. Keep it up until evening.", category: "fitness", difficulty: "easy", attribute: "vitality", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.read-chapter", title: "Read one chapter of a book", description: "Any book that teaches you something or stretches your thinking.", category: "learning", difficulty: "normal", attribute: "intelligence", estimatedMinutes: 30, cadence: "daily" },
  { key: "daily.watch-lesson", title: "Watch a lesson and take notes", description: "A lecture, tutorial or talk. Write down three things you'd want to remember.", category: "learning", difficulty: "normal", attribute: "intelligence", estimatedMinutes: 30, cadence: "daily" },
  { key: "daily.explain-it", title: "Explain something you learned", description: "Teach it to someone or write it out simply. Gaps will show up fast.", category: "learning", difficulty: "easy", attribute: "intelligence", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.flashcards", title: "Review your notes or flashcards", description: "Revisit something you learned last week so it sticks.", category: "learning", difficulty: "easy", attribute: "intelligence", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.deep-study", title: "Study a hard topic for 60 minutes", description: "Pick the subject you've been avoiding and stay with it.", category: "learning", difficulty: "hard", attribute: "intelligence", estimatedMinutes: 60, cadence: "daily" },
  { key: "daily.new-word", title: "Learn five new words", description: "In a language you're learning, or a field you're exploring.", category: "learning", difficulty: "easy", attribute: "intelligence", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.top-task", title: "Finish your most important work task first", description: "Do it before messages and meetings get a chance to take over.", category: "career", difficulty: "normal", attribute: "discipline", estimatedMinutes: 45, cadence: "daily" },
  { key: "daily.update-cv", title: "Improve one part of your CV or portfolio", description: "One bullet, one project description, one better example.", category: "career", difficulty: "normal", attribute: "intelligence", estimatedMinutes: 25, cadence: "daily" },
  { key: "daily.industry-read", title: "Read an article about your field", description: "Find one idea you could actually use, and note it.", category: "career", difficulty: "easy", attribute: "intelligence", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.reach-mentor", title: "Message someone you can learn from", description: "A mentor, a colleague or someone whose work you admire.", category: "career", difficulty: "easy", attribute: "vitality", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.clear-backlog", title: "Clear something off your work backlog", description: "That small task that keeps moving to tomorrow. Today it's done.", category: "career", difficulty: "normal", attribute: "discipline", estimatedMinutes: 30, cadence: "daily" },
  { key: "daily.project-90", title: "Spend 90 minutes on a career project", description: "A certification, side project or application that moves you forward.", category: "career", difficulty: "hard", attribute: "intelligence", estimatedMinutes: 90, cadence: "daily" },
  { key: "daily.sketch", title: "Sketch something for 15 minutes", description: "Whatever's in front of you. It doesn't have to be good.", category: "creativity", difficulty: "easy", attribute: "creativity", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.ten-ideas", title: "Write down ten ideas", description: "Business names, stories, projects, anything. Quantity over quality.", category: "creativity", difficulty: "easy", attribute: "creativity", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.photo-walk", title: "Take five photos you like", description: "Look for light, patterns or something you'd usually walk past.", category: "creativity", difficulty: "easy", attribute: "creativity", estimatedMinutes: 20, cadence: "daily" },
  { key: "daily.make-30", title: "Work on a creative project for 30 minutes", description: "Music, design, writing, code or craft: move it forward a little.", category: "creativity", difficulty: "normal", attribute: "creativity", estimatedMinutes: 30, cadence: "daily" },
  { key: "daily.remix", title: "Recreate something you admire", description: "Copy a design, song or paragraph to learn how it was made.", category: "creativity", difficulty: "normal", attribute: "creativity", estimatedMinutes: 30, cadence: "daily" },
  { key: "daily.finish-share", title: "Finish a small piece and share it", description: "Publish it or show one person. Finished beats perfect.", category: "creativity", difficulty: "hard", attribute: "creativity", estimatedMinutes: 60, cadence: "daily" },
  { key: "daily.review-subs", title: "Review one subscription", description: "Still using it? Keep it deliberately, or cancel it.", category: "finance", difficulty: "easy", attribute: "discipline", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.no-spend", title: "Have a no-spend day", description: "Essentials only. Notice what you reach for out of habit.", category: "finance", difficulty: "normal", attribute: "discipline", estimatedMinutes: 5, cadence: "daily" },
  { key: "daily.budget-check", title: "Check your budget against your spending", description: "Compare this month so far with your plan and adjust.", category: "finance", difficulty: "normal", attribute: "discipline", estimatedMinutes: 20, cadence: "daily" },
  { key: "daily.savings-transfer", title: "Move something into savings", description: "Any amount counts. It's the habit that matters.", category: "finance", difficulty: "easy", attribute: "discipline", estimatedMinutes: 5, cadence: "daily" },
  { key: "daily.learn-money", title: "Learn one money concept", description: "Inflation, compound interest, index funds: pick one and understand it.", category: "finance", difficulty: "easy", attribute: "intelligence", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.plan-month", title: "Plan next month's big expenses", description: "List what's coming so that nothing catches you by surprise.", category: "finance", difficulty: "normal", attribute: "discipline", estimatedMinutes: 25, cadence: "daily" },
  { key: "daily.inbox-zero", title: "Clear your inbox or messages", description: "Reply, archive or delete until only what matters is left.", category: "organization", difficulty: "normal", attribute: "discipline", estimatedMinutes: 20, cadence: "daily" },
  { key: "daily.plan-tomorrow", title: "Plan tomorrow tonight", description: "Choose the top three tasks now, so you start with a decision made.", category: "organization", difficulty: "easy", attribute: "discipline", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.declutter", title: "Declutter one small area", description: "A drawer, a shelf or a bag. Keep it small enough to finish.", category: "organization", difficulty: "easy", attribute: "discipline", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.digital-tidy", title: "Tidy your digital files", description: "Clear your desktop, your downloads or a messy folder.", category: "organization", difficulty: "easy", attribute: "discipline", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.overdue-task", title: "Do the task you keep putting off", description: "You know the one. Start with five minutes and see how far you get.", category: "organization", difficulty: "hard", attribute: "discipline", estimatedMinutes: 45, cadence: "daily" },
  { key: "daily.weekly-prep", title: "Prepare meals or clothes in advance", description: "Make tomorrow easier by doing something for it today.", category: "organization", difficulty: "normal", attribute: "discipline", estimatedMinutes: 30, cadence: "daily" },
  { key: "daily.thank-someone", title: "Thank someone properly", description: "Tell them specifically what they did and why it mattered.", category: "social", difficulty: "easy", attribute: "vitality", estimatedMinutes: 5, cadence: "daily" },
  { key: "daily.call-family", title: "Call a friend or relative", description: "A real conversation, voice or video, not just a text.", category: "social", difficulty: "normal", attribute: "vitality", estimatedMinutes: 20, cadence: "daily" },
  { key: "daily.help-someone", title: "Do something helpful for someone", description: "Offer before they ask, and expect nothing back.", category: "social", difficulty: "normal", attribute: "vitality", estimatedMinutes: 20, cadence: "daily" },
  { key: "daily.meet-in-person", title: "Spend time with someone in person", description: "Share a meal, a walk or a coffee, with your phone away.", category: "social", difficulty: "hard", attribute: "vitality", estimatedMinutes: 60, cadence: "daily" },
  { key: "daily.reconnect", title: "Reconnect with an old friend", description: "Send a message to someone you've lost touch with.", category: "social", difficulty: "easy", attribute: "vitality", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.listen-well", title: "Really listen in one conversation", description: "No phone and no planning your reply. Ask one more question than usual.", category: "social", difficulty: "easy", attribute: "vitality", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.journal", title: "Write in a journal for 10 minutes", description: "What's on your mind? No structure and no audience.", category: "wellbeing", difficulty: "easy", attribute: "vitality", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.breathe", title: "Take 10 minutes to breathe or meditate", description: "Sit somewhere quiet. If your mind wanders, that's normal.", category: "wellbeing", difficulty: "easy", attribute: "vitality", estimatedMinutes: 10, cadence: "daily" },
  { key: "daily.gratitude", title: "Write down three good things", description: "Small ones count. Include why each one happened.", category: "wellbeing", difficulty: "easy", attribute: "vitality", estimatedMinutes: 5, cadence: "daily" },
  { key: "daily.outside-time", title: "Spend 30 minutes outside", description: "Get some daylight and fresh air, and leave the headphones behind.", category: "wellbeing", difficulty: "normal", attribute: "vitality", estimatedMinutes: 30, cadence: "daily" },
  { key: "daily.sleep-early", title: "Get to bed on time tonight", description: "Decide your bedtime now and start winding down before it.", category: "wellbeing", difficulty: "normal", attribute: "vitality", estimatedMinutes: 15, cadence: "daily" },
  { key: "daily.phone-free", title: "Have a phone-free hour", description: "Put it in another room and do something offline.", category: "wellbeing", difficulty: "normal", attribute: "discipline", estimatedMinutes: 60, cadence: "daily" },
  { key: "daily.cook-meal", title: "Cook yourself a proper meal", description: "Something nourishing that you'd be glad to eat again.", category: "wellbeing", difficulty: "normal", attribute: "vitality", estimatedMinutes: 45, cadence: "daily" },
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
