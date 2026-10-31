import { expect, test } from "./fixtures";
import { registerPlayer, sql, userIdFor, visit } from "./support";

// The core loop from the brief, end to end in a real browser:
// register → onboard → starter quests → complete (XP exactly once) → level-up at the
// threshold → achievement → focus session recorded → progress reflects it.
test("a new player's first session", async ({ page }) => {
  // 1–2. Register and onboard with four focus areas.
  const email = await registerPlayer(page, { areas: ["learning", "fitness", "career", "creativity"] });
  await expect(page.getByText("Player registered.")).toBeVisible();
  const userId = await userIdFor(email);

  // 3. Starter quests exist (review + one per area, capped at 5).
  await visit(page, "/system/quests");
  for (const title of ["Review your daily priorities", "Complete a workout", "Read or study for 30 minutes", "Practice a skill for 45 minutes", "Write 300 words"]) {
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  }

  // 4–5. Complete a 50 XP quest with a double click: XP is granted exactly once,
  //      and First Blood (+10) unlocks.
  await page.getByRole("button", { name: "Complete Practice a skill for 45 minutes" }).dblclick();
  const message = page.getByRole("status").filter({ hasText: "Quest completed" });
  await expect(message).toContainText("+50 XP");
  await expect(message).toContainText("First Blood");
  await expect(page.getByText("60/100 XP")).toBeVisible();
  const grants = await sql`
    select event_type, amount from xp_ledger where user_id = ${userId} order by created_at`;
  expect(grants.map((g) => [g.event_type, g.amount])).toEqual([
    ["quest_completed", 50],
    ["achievement_unlocked", 10],
  ]);
  const [{ n: completions }] = await sql`select count(*)::int as n from quest_completion where user_id = ${userId}`;
  expect(completions).toBe(1);

  // 6. 60 + 25 = 85: no level-up yet. 85 + 25 = 110 ≥ 100: level 2.
  await page.getByRole("button", { name: "Complete Complete a workout" }).click();
  await expect(page.getByText("85/100 XP")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Level up" })).toHaveCount(0);
  await page.getByRole("button", { name: "Complete Read or study for 30 minutes" }).click();
  const levelUp = page.getByRole("heading", { name: "Level up" });
  await expect(levelUp).toBeVisible();
  await expect(page.locator(".levelup")).toContainText("Lv 2");
  await page.keyboard.press("Escape");
  await expect(levelUp).toHaveCount(0);
  await expect(page.getByText("10/120 XP")).toBeVisible();

  // 7. The achievement is recorded on the achievements page.
  await visit(page, "/system/achievements");
  const firstBlood = page.getByRole("listitem").filter({ hasText: "First Blood" });
  await expect(firstBlood).toContainText("Unlocked");

  // 8. Focus: start a session, let 15 minutes pass on the server's clock, reload — the
  //    page recovers the session and completes it; the server validates the duration.
  await visit(page, "/system/focus");
  await page.getByRole("button", { name: "15m" }).click();
  await page.getByRole("button", { name: "Start 15-minute session" }).click();
  await expect(page.getByRole("timer")).toContainText("Focus");
  await sql`update focus_session set started_at = started_at - interval '15 minutes' where user_id = ${userId}`;
  await visit(page, "/system/focus");
  await expect(page.getByText(/Session complete\./)).toBeVisible();
  await expect(page.getByText("Full", { exact: true })).toBeVisible();
  const [session] = await sql`select status, credited_seconds from focus_session where user_id = ${userId}`;
  expect(session).toMatchObject({ status: "completed", credited_seconds: 900 });

  // 9. The progress page reflects the recorded activity exactly.
  const [{ xp }] = await sql`select coalesce(sum(amount), 0)::int as xp from xp_ledger where user_id = ${userId}`;
  await visit(page, "/system/progress?range=7d");
  const tile = (label: string) => page.locator("dl > div").filter({ hasText: label });
  await expect(tile("XP earned")).toContainText(String(xp));
  await expect(tile("Quests completed")).toContainText("3");
  await expect(tile("Focus time")).toContainText("15m");
  await expect(tile("Achievements")).toContainText("1");
});
