// The evening reminder's wording. Pure, so it can be tested without a database or push service.

/** The reminder text, or null when there's nothing worth a nudge. Pure, for tests. */
export function reminderMessage(openQuests: number, questsToday: number, streak: number, activeToday: boolean) {
  if (questsToday === 0) {
    return streak > 0 && !activeToday
      ? { title: "Your streak needs you", body: `Open AWAKEN and complete a quest to keep your ${streak}-day streak.` }
      : { title: "Your daily quests are waiting", body: "Open AWAKEN to see today's quests." };
  }
  if (openQuests === 0) return null;
  const left = `${openQuests} quest${openQuests === 1 ? "" : "s"} left today`;
  if (streak > 0 && !activeToday) return { title: "Streak at risk", body: `${left}. Complete one to keep your ${streak}-day streak.` };
  return { title: "Almost there", body: `${left}. Finish them all for the daily combo bonus.` };
}

