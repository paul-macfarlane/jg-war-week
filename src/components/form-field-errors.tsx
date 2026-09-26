"use client";

import { type RefObject, useEffect } from "react";

import type { FieldErrors, WriteResult } from "@/lib/result";

/** A control focus can land on: enabled, visible to the keyboard. */
export const FOCUSABLE =
  "input:not([type=hidden]):not(:disabled), button:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";

/** What a form's `useActionState` holds: nothing yet, or the last result. */
type FormState = WriteResult | null;

/** The last refusal's message per field; empty when there is none. */
export function fieldErrorsOf(state: FormState): FieldErrors {
  return state && !state.ok ? (state.fieldErrors ?? {}) : {};
}

/**
 * The last refusal's message when no field shows it (an authorization
 * refusal, say), for the form-level `FieldError` under the buttons.
 */
export function formErrorOf(state: FormState): string | null {
  if (!state || state.ok) return null;
  const owned = Object.values(state.fieldErrors ?? {});
  return owned.includes(state.error) ? null : state.error;
}

/**
 * Focuses the first control of the first invalid field in `form` (a
 * `Field` with `data-invalid`, in DOM order) when `fieldErrors` names any.
 */
export function focusFirstInvalid(
  form: HTMLFormElement | null,
  fieldErrors: FieldErrors | undefined,
) {
  if (!form || !fieldErrors || Object.keys(fieldErrors).length === 0) return;
  form
    .querySelector("[data-slot=field][data-invalid=true]")
    ?.querySelector<HTMLElement>(FOCUSABLE)
    ?.focus();
}

/**
 * After a refused submit, moves focus to the first invalid field. The
 * fields mark themselves: `Field data-invalid`, the control `aria-invalid`,
 * and `<FieldError>{fieldErrors[name]}</FieldError>` under it.
 */
export function useFocusFirstInvalid(
  formRef: RefObject<HTMLFormElement | null>,
  state: FormState,
) {
  useEffect(() => {
    if (state && !state.ok) {
      focusFirstInvalid(formRef.current, state.fieldErrors);
    }
  }, [formRef, state]);
}
