import { describe, expect, it } from "vitest";

import { parseHeatScheduleInput } from "@/lib/bracket/heat-schedule";

const DAY_ID = "8b0a4f0e-2a4e-4c1a-9a57-2f7c7b6f5d11";

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseHeatScheduleInput", () => {
  it("accepts a Day, start time and location together", () => {
    expect(
      parseHeatScheduleInput(
        formData({ dayId: DAY_ID, startTime: "19:00", location: "Main room" }),
      ),
    ).toEqual({
      ok: true,
      value: { dayId: DAY_ID, startTime: "19:00", location: "Main room" },
    });
  });

  it("accepts clearing every field", () => {
    expect(
      parseHeatScheduleInput(
        formData({ dayId: "", startTime: "", location: "" }),
      ),
    ).toEqual({
      ok: true,
      value: { dayId: null, startTime: null, location: null },
    });
  });

  it("accepts a location on its own, with no Day or start time", () => {
    expect(
      parseHeatScheduleInput(
        formData({ dayId: "", startTime: "", location: "Table 3" }),
      ),
    ).toEqual({
      ok: true,
      value: { dayId: null, startTime: null, location: "Table 3" },
    });
  });

  it("refuses a Day without a start time", () => {
    expect(
      parseHeatScheduleInput(
        formData({ dayId: DAY_ID, startTime: "", location: "" }),
      ),
    ).toEqual({
      ok: false,
      error: "Pick a Day and a start time together, or clear both.",
      fieldErrors: {
        startTime: "Pick a Day and a start time together, or clear both.",
      },
    });
  });

  it("refuses a start time without a Day", () => {
    expect(
      parseHeatScheduleInput(
        formData({ dayId: "", startTime: "19:00", location: "" }),
      ),
    ).toEqual({
      ok: false,
      error: "Pick a Day and a start time together, or clear both.",
      fieldErrors: {
        startTime: "Pick a Day and a start time together, or clear both.",
      },
    });
  });

  it("refuses an invalid Day id", () => {
    const result = parseHeatScheduleInput(
      formData({ dayId: "not-a-uuid", startTime: "19:00", location: "" }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors?.dayId).toBe("Pick a Day.");
  });

  it("refuses a start time that isn't 24-hour HH:MM", () => {
    const result = parseHeatScheduleInput(
      formData({ dayId: DAY_ID, startTime: "7:00 PM", location: "" }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors?.startTime).toBe(
      "Start time must be a 24-hour HH:MM time.",
    );
  });

  it("refuses a location over 200 characters", () => {
    const result = parseHeatScheduleInput(
      formData({ dayId: "", startTime: "", location: "x".repeat(201) }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors?.location).toBe(
      "Location must be at most 200 characters.",
    );
  });
});
