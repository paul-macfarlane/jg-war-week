import { describe, expect, it } from "vitest";

import { fieldErrorsOf, formErrorOf } from "@/components/form-field-errors";

describe("fieldErrorsOf", () => {
  it("is empty before any submit", () => {
    expect(fieldErrorsOf(null)).toEqual({});
  });

  it("is empty after a success", () => {
    expect(fieldErrorsOf({ ok: true })).toEqual({});
  });

  it("is empty for a refusal that names no field", () => {
    expect(fieldErrorsOf({ ok: false, error: "Organizers only." })).toEqual({});
  });

  it("is the refusal's message per field", () => {
    expect(
      fieldErrorsOf({
        ok: false,
        error: "Points must be at most 999999.99.",
        fieldErrors: { points: "Points must be at most 999999.99." },
      }),
    ).toEqual({ points: "Points must be at most 999999.99." });
  });
});

describe("formErrorOf", () => {
  it("is null before any submit and after a success", () => {
    expect(formErrorOf(null)).toBeNull();
    expect(formErrorOf({ ok: true })).toBeNull();
  });

  it("is the message of a refusal no field shows", () => {
    expect(formErrorOf({ ok: false, error: "Organizers only." })).toBe(
      "Organizers only.",
    );
  });

  it("is null when a field already shows the message", () => {
    expect(
      formErrorOf({
        ok: false,
        error: "Slack URL must be an https URL.",
        fieldErrors: { slackChannelUrl: "Slack URL must be an https URL." },
      }),
    ).toBeNull();
  });

  it("is the message when the fields show other messages", () => {
    expect(
      formErrorOf({
        ok: false,
        error: "That War Week has ended.",
        fieldErrors: { winner: "Winner is too long." },
      }),
    ).toBe("That War Week has ended.");
  });
});
