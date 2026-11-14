import { afterEach, describe, expect, it } from "vitest";
import { assertDatabaseChangeAllowed, assertLocalDatabase, isLocalDatabase } from "@/db/safety";

const REMOTE = "postgresql://u:p@db.example.com:5432/awaken?sslmode=require";
const LOCAL = "postgres://awaken:awaken@localhost:54350/awaken";

afterEach(() => {
  delete process.env.CONFIRM_PRODUCTION_DB;
});

describe("database safety guards", () => {
  it("recognises local databases only", () => {
    for (const url of [LOCAL, "postgres://a:b@127.0.0.1/x"]) expect(isLocalDatabase(url)).toBe(true);
    for (const url of [REMOTE, "postgres://a:b@localhost.evil.example/x", "not a url", undefined]) {
      expect(isLocalDatabase(url)).toBe(false);
    }
  });

  it("never lets tests reach a remote database, even when confirmed", () => {
    process.env.CONFIRM_PRODUCTION_DB = "yes";
    expect(() => assertLocalDatabase(REMOTE, "tests")).toThrow(/Refusing/);
    expect(() => assertLocalDatabase(LOCAL, "tests")).not.toThrow();
  });

  it("blocks changes to a remote database unless deliberately confirmed", () => {
    expect(() => assertDatabaseChangeAllowed(REMOTE, "db:seed")).toThrow(/Refusing/);
    expect(() => assertDatabaseChangeAllowed(LOCAL, "db:seed")).not.toThrow();
    process.env.CONFIRM_PRODUCTION_DB = "yes";
    expect(() => assertDatabaseChangeAllowed(REMOTE, "db:seed")).not.toThrow();
  });

  it("never includes the connection string in its errors", () => {
    expect(() => assertLocalDatabase(REMOTE, "tests")).not.toThrow(/example\.com|u:p/);
    expect(() => assertDatabaseChangeAllowed(REMOTE, "db:seed")).not.toThrow(/example\.com|u:p/);
  });
});
