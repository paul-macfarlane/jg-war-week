import { describe, expect, it } from "vitest";
import { z } from "zod";

import { fieldErrorsFrom } from "@/lib/form-errors";

const schema = z.object({
  name: z
    .string()
    .min(1, { error: "must not be empty" })
    .max(5, { error: "must be at most 5 characters" }),
  teamId: z.uuid({ error: "Choose a Team." }),
  links: z.array(z.url({ error: "must be a link" })),
});

function errorOf(input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected a refusal");
  return result.error;
}

const labels = { name: "Name", links: "Link" };

describe("fieldErrorsFrom", () => {
  it("words a 'must …' issue with its field's label, and leaves a sentence alone", () => {
    expect(
      fieldErrorsFrom(errorOf({ name: "", teamId: "nope", links: [] }), {
        labels,
      }),
    ).toEqual({
      error: "Name must not be empty.",
      fieldErrors: {
        name: "Name must not be empty.",
        teamId: "Choose a Team.",
      },
    });
  });

  it("keeps the first issue per field", () => {
    const error = errorOf({ name: "", teamId: "nope", links: [] });
    // A second issue on `name`, after the first.
    error.issues.push({
      code: "custom",
      path: ["name"],
      message: "must be something else",
      input: "",
    });
    expect(fieldErrorsFrom(error, { labels }).fieldErrors.name).toBe(
      "Name must not be empty.",
    );
  });

  it("maps a nested path to its top-level field", () => {
    expect(
      fieldErrorsFrom(
        errorOf({
          name: "ok",
          teamId: "8b0a4f0e-2a4e-4c1a-9a57-2f7c7b6f5d11",
          links: ["https://a.example", "nope", "also nope"],
        }),
        { labels },
      ),
    ).toEqual({
      error: "Link must be a link.",
      fieldErrors: { links: "Link must be a link." },
    });
  });

  it("puts a root-level issue in the error only", () => {
    expect(fieldErrorsFrom(errorOf("not an object"))).toEqual({
      error: "Invalid input: expected object, received string",
      fieldErrors: {},
    });
  });

  it("lets describe word an issue, falling back to the label rule", () => {
    const describe = (issue: z.core.$ZodIssue) =>
      issue.path[0] === "teamId" ? "Pick a Team of this War Week." : null;
    expect(
      fieldErrorsFrom(errorOf({ name: "toolong", teamId: "x", links: [] }), {
        labels,
        describe,
      }),
    ).toEqual({
      error: "Name must be at most 5 characters.",
      fieldErrors: {
        name: "Name must be at most 5 characters.",
        teamId: "Pick a Team of this War Week.",
      },
    });
  });

  it("uses the raw message when the field has no label", () => {
    expect(
      fieldErrorsFrom(errorOf({ name: "", teamId: "x", links: [] })),
    ).toMatchObject({ error: "must not be empty" });
  });
});
