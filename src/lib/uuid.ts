import { z } from "zod";

/** A row id: every table keys its rows by uuid. */
const uuidSchema = z.uuid();

/**
 * Whether a URL segment or action argument is shaped like a row id, checked
 * before it reaches a query so a malformed one reads as "not found".
 */
export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}
