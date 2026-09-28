import { describe, expect, it } from "vitest";

import { forceableConfirmCopy } from "./bracket-builder";

const TITLE = "Clear every Heat Result and draw again?";

describe("forceableConfirmCopy", () => {
  it("returns null when no Heat is timed", () => {
    expect(forceableConfirmCopy(0, false, TITLE)).toBeNull();
    expect(forceableConfirmCopy(0, true, TITLE)).toBeNull();
  });

  it("warns about clearing times only, singular, when there are no Heat Results", () => {
    expect(forceableConfirmCopy(1, false, TITLE)).toEqual({
      title: "Draw again?",
      description: "This clears 1 Heat time.",
      confirmLabel: "Clear times",
    });
  });

  it("warns about clearing every Heat Result and the Heat times, plural", () => {
    expect(forceableConfirmCopy(3, true, TITLE)).toEqual({
      title: TITLE,
      description: "This clears every Heat Result and 3 Heat times.",
      confirmLabel: "Clear results",
    });
  });
});
