import type { QuestDate } from "@/lib/time";
import { CATEGORIES, type Category, type Difficulty } from "./config";

// Chooses each day's quests. Pure and deterministic: the same inputs always give the same answer, so
// reloads and parallel requests agree, while a different player or day gets a different mix.
// See docs/ARCHITECTURE.md §6.

export const DEFAULT_DAILY_QUESTS = 5;

export type RotationTemplate = { id: string; category: Category; difficulty: Difficulty };

/** FNV-1a: a small, stable hash, used only to break ties unpredictably. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickDailyQuests({
  pool,
  focusAreas,
  count,
  seed,
  lastSeen,
}: {
  pool: readonly RotationTemplate[];
  focusAreas: readonly Category[];
  count: number;
  /** Differs per player and day, e.g. `${userId}:${date}`. */
  seed: string;
  /** When the player last had each template. Quests they haven't had recently come first. */
  lastSeen: ReadonlyMap<string, QuestDate>;
}): string[] {
  // Least recently seen first, so nothing repeats until the alternatives have had a turn.
  const fresh = [...pool].sort((a, b) => {
    const seenA = lastSeen.get(a.id) ?? "";
    const seenB = lastSeen.get(b.id) ?? "";
    return seenA === seenB ? hash(seed + a.id) - hash(seed + b.id) : seenA < seenB ? -1 : 1;
  });

  const picked: RotationTemplate[] = [];
  // Keep a day achievable: only about a third of it may be big quests.
  const maxBig = Math.max(1, Math.floor(count / 3));
  const isBig = (t: RotationTemplate) => t.difficulty === "hard" || t.difficulty === "elite";
  const take = (candidates: readonly RotationTemplate[], respectBigLimit: boolean) => {
    const bigCount = picked.filter(isBig).length;
    const next = candidates.find(
      (t) => !picked.includes(t) && (!respectBigLimit || !isBig(t) || bigCount < maxBig),
    );
    if (next) picked.push(next);
    return !!next;
  };

  const focus = focusAreas.filter((area) => pool.some((t) => t.category === area));
  // Areas that haven't appeared for longest go first, so no category gets used up early.
  const areaLastSeen = (area: Category) =>
    pool.reduce((latest, t) => {
      const seen = t.category === area ? (lastSeen.get(t.id) ?? "") : "";
      return seen > latest ? seen : latest;
    }, "");
  const rotation = (focus.length > 0 ? focus : [...CATEGORIES]).toSorted((a, b) => {
    const seenA = areaLastSeen(a);
    const seenB = areaLastSeen(b);
    return seenA === seenB ? hash(seed + a) - hash(seed + b) : seenA < seenB ? -1 : 1;
  });

  // The most recent day in the history: its quests are skipped unless there's truly nothing else.
  const lastDay = [...lastSeen.values()].reduce((latest, date) => (date > latest ? date : latest), "");
  const rested = fresh.filter((t) => lastSeen.get(t.id) !== lastDay);

  // Most slots go to the player's focus areas in turn. One in five goes elsewhere, for variety.
  const outside = rested.filter((t) => !rotation.includes(t.category));
  const outsideSlots = outside.length > 0 && count >= 3 ? Math.max(1, Math.floor(count / 5)) : 0;
  for (let i = 0; i < outsideSlots; i++) take(outside, true);

  let area = 0;
  let idleAreas = 0;
  while (picked.length < count && idleAreas < rotation.length) {
    const category = rotation[area % rotation.length];
    idleAreas = take(rested.filter((t) => t.category === category), true) ? 0 : idleAreas + 1;
    area++;
  }

  // Too few left in those areas: widen to anything rested, then, only if the pool is tiny, to anything.
  while (picked.length < count && (take(rested, true) || take(fresh, true) || take(fresh, false)));

  return picked.map((t) => t.id);
}
