import { describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "@/db/local-url";

describe("isLocalDatabaseUrl", () => {
  it("accepts localhost", () => {
    expect(
      isLocalDatabaseUrl("postgres://u:p@localhost:5432/db", "node-postgres"),
    ).toBe(true);
  });

  it("accepts 127.0.0.1", () => {
    expect(
      isLocalDatabaseUrl("postgres://u:p@127.0.0.1:5432/db", "node-postgres"),
    ).toBe(true);
  });

  it("accepts [::1]", () => {
    expect(
      isLocalDatabaseUrl("postgres://u:p@[::1]:5432/db", "node-postgres"),
    ).toBe(true);
  });

  it("rejects a hosted database", () => {
    expect(isLocalDatabaseUrl("postgres://u:p@ep-x.neon.tech/db", "neon")).toBe(
      false,
    );
  });

  it("rejects a lookalike host", () => {
    expect(
      isLocalDatabaseUrl(
        "postgres://u:p@localhost.example.com/db",
        "node-postgres",
      ),
    ).toBe(false);
  });

  it("rejects the neon driver even on localhost", () => {
    expect(isLocalDatabaseUrl("postgres://u:p@localhost:5432/db", "neon")).toBe(
      false,
    );
  });

  it("rejects an undefined URL", () => {
    expect(isLocalDatabaseUrl(undefined, "node-postgres")).toBe(false);
  });
});
