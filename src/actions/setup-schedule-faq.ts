"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize } from "@/auth/authorize";
import {
  type FaqItemInput,
  type ScheduleItemInput,
  parseFaqItemInput,
  parseScheduleItemInput,
} from "@/lib/setup-schedule-faq";
import * as mutations from "@/mutations/setup-schedule-faq";
import type { MutationResult } from "@/mutations/types";

export type SetupScheduleFaqActionResult = MutationResult;

/**
 * Adds a Schedule Item to the War Week the form was rendered for.
 */
export async function createScheduleItem(
  warWeekId: string,
  input: ScheduleItemInput,
): Promise<SetupScheduleFaqActionResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "schedule-item.create",
      "warWeek",
      warWeekId,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseScheduleItemInput(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.createScheduleItem(
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function updateScheduleItem(
  id: string,
  input: ScheduleItemInput,
): Promise<SetupScheduleFaqActionResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "schedule-item.edit",
      "scheduleItem",
      id,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseScheduleItemInput(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.updateScheduleItem(
      id,
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function deleteScheduleItem(
  id: string,
): Promise<SetupScheduleFaqActionResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "schedule-item.delete",
      "scheduleItem",
      id,
    );
    if (!authorized.ok) return authorized;

    const result = await mutations.deleteScheduleItem(id, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** Adds an FAQ Item to the War Week the form was rendered for. */
export async function createFaqItem(
  warWeekId: string,
  input: FaqItemInput,
): Promise<SetupScheduleFaqActionResult> {
  return guarded(async () => {
    const authorized = await authorize("faq-item.create", "warWeek", warWeekId);
    if (!authorized.ok) return authorized;
    const parsed = parseFaqItemInput(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.createFaqItem(parsed.value, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function updateFaqItem(
  id: string,
  input: FaqItemInput,
): Promise<SetupScheduleFaqActionResult> {
  return guarded(async () => {
    const authorized = await authorize("faq-item.edit", "faqItem", id);
    if (!authorized.ok) return authorized;
    const parsed = parseFaqItemInput(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.updateFaqItem(
      id,
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function deleteFaqItem(
  id: string,
): Promise<SetupScheduleFaqActionResult> {
  return guarded(async () => {
    const authorized = await authorize("faq-item.delete", "faqItem", id);
    if (!authorized.ok) return authorized;

    const result = await mutations.deleteFaqItem(id, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function moveFaqItem(
  id: string,
  direction: "up" | "down",
): Promise<SetupScheduleFaqActionResult> {
  return guarded(async () => {
    const authorized = await authorize("faq-item.move", "faqItem", id);
    if (!authorized.ok) return authorized;
    if (direction !== "up" && direction !== "down") {
      return { ok: false, error: "Move an FAQ Item up or down." };
    }

    const result = await mutations.moveFaqItem(id, direction, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}
