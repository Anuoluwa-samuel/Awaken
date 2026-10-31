import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/db";
process.env.BETTER_AUTH_SECRET ??= "x".repeat(32);
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
const { sendWithResend } = await import("@/lib/email");

describe("sendWithResend", () => {
  it("posts a plain-text email with the API key as a bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendWithResend({ to: "a@b.test", subject: "Hi", text: "Body" }, "re_test", "AWAKEN <s@x.test>", fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toEqual({ from: "AWAKEN <s@x.test>", to: ["a@b.test"], subject: "Hi", text: "Body" });
  });

  it("throws with the status only, never the key or body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"message":"bad a@b.test"}', { status: 422 }));
    const err = await sendWithResend({ to: "a@b.test", subject: "Hi", text: "B" }, "re_secret", "s@x.test", fetchImpl).catch((e) => e);
    expect(err.message).toBe("Email provider rejected the message (HTTP 422).");
    expect(err.message).not.toContain("re_secret");
    expect(err.message).not.toContain("a@b.test");
  });
});
