import { describe, expect, it } from "vitest";

import { trustedOrigins } from "@/auth/trusted-origins";

describe("trustedOrigins", () => {
  it("production gives only the base origin", () => {
    expect(
      trustedOrigins({
        BETTER_AUTH_URL: "https://jg-war-week.vercel.app",
        VERCEL_ENV: "production",
        VERCEL_URL: "jg-war-week-abc123.vercel.app",
        VERCEL_BRANCH_URL: "jg-war-week-git-main.vercel.app",
      }),
    ).toEqual(["https://jg-war-week.vercel.app"]);
  });

  it("a preview adds exactly its two Vercel hosts", () => {
    expect(
      trustedOrigins({
        BETTER_AUTH_URL: "https://jg-war-week-staging.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_URL: "jg-war-week-abc123.vercel.app",
        VERCEL_BRANCH_URL: "jg-war-week-git-feat-foo.vercel.app",
      }),
    ).toEqual([
      "https://jg-war-week-staging.vercel.app",
      "https://jg-war-week-abc123.vercel.app",
      "https://jg-war-week-git-feat-foo.vercel.app",
    ]);
  });

  it("a preview with a missing or blank branch URL adds only the deployment host", () => {
    expect(
      trustedOrigins({
        BETTER_AUTH_URL: "https://jg-war-week-staging.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_URL: "jg-war-week-abc123.vercel.app",
        VERCEL_BRANCH_URL: undefined,
      }),
    ).toEqual([
      "https://jg-war-week-staging.vercel.app",
      "https://jg-war-week-abc123.vercel.app",
    ]);

    expect(
      trustedOrigins({
        BETTER_AUTH_URL: "https://jg-war-week-staging.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_URL: "jg-war-week-abc123.vercel.app",
        VERCEL_BRANCH_URL: "   ",
      }),
    ).toEqual([
      "https://jg-war-week-staging.vercel.app",
      "https://jg-war-week-abc123.vercel.app",
    ]);
  });

  it("normalizes values that already carry a scheme or trailing slash", () => {
    expect(
      trustedOrigins({
        BETTER_AUTH_URL: "https://jg-war-week-staging.vercel.app/",
        VERCEL_ENV: "preview",
        VERCEL_URL: "https://jg-war-week-abc123.vercel.app/",
        VERCEL_BRANCH_URL: "  http://jg-war-week-git-feat-foo.vercel.app/  ",
      }),
    ).toEqual([
      "https://jg-war-week-staging.vercel.app",
      "https://jg-war-week-abc123.vercel.app",
      "https://jg-war-week-git-feat-foo.vercel.app",
    ]);
  });

  it("has no duplicates when the deployment host equals the branch alias", () => {
    expect(
      trustedOrigins({
        BETTER_AUTH_URL: "https://jg-war-week-staging.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_URL: "jg-war-week-abc123.vercel.app",
        VERCEL_BRANCH_URL: "jg-war-week-abc123.vercel.app",
      }),
    ).toEqual([
      "https://jg-war-week-staging.vercel.app",
      "https://jg-war-week-abc123.vercel.app",
    ]);
  });
});
