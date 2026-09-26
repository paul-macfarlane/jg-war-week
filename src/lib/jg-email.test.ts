import { describe, expect, it } from "vitest";

import { JG_EMAIL_MESSAGE, jgEmailSchema } from "@/lib/jg-email";

const at = "@jahnelgroup.com";

describe("jgEmailSchema", () => {
  it("accepts a JG email, trimmed and lowercased", () => {
    expect(jgEmailSchema.parse("  Tony@JahnelGroup.com ")).toBe(
      "tony@jahnelgroup.com",
    );
  });

  it("accepts a 254-character JG email", () => {
    const email = `${"a".repeat(254 - at.length)}${at}`;
    expect(jgEmailSchema.parse(email)).toBe(email);
  });

  it.each([
    ["an empty string", ""],
    ["another domain", "someone@gmail.com"],
    ["a subdomain", "someone@mail.jahnelgroup.com"],
    ["a look-alike domain", "someone@jahnelgroup.com.evil.com"],
    ["two @ signs", "a@b@jahnelgroup.com"],
    ["no @", "not-an-email"],
    ["255 characters", `${"a".repeat(255 - at.length)}${at}`],
    ["a non-string", 42],
  ])("refuses %s with one message", (_, value) => {
    const result = jgEmailSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      JG_EMAIL_MESSAGE,
    ]);
  });

  it("says to use a JG email", () => {
    expect(JG_EMAIL_MESSAGE).toBe("Use an @jahnelgroup.com email.");
  });
});
