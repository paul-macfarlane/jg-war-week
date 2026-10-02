"use client";

import { useActionState, useRef } from "react";

import { testSignIn } from "@/actions/test-sign-in";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { WriteResult } from "@/lib/result";
import type { TestSignInInput } from "@/lib/test-sign-in";

/** The `/sign-in/test` form: an email and the server's secret. */
export function TestSignInForm({ callbackURL }: { callbackURL: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  // Validation runs on the server; success redirects, so only a refusal
  // comes back.
  const [result, formAction, pending] = useActionState(
    async (
      _previous: WriteResult | null,
      formData: FormData,
    ): Promise<WriteResult> => {
      const input: TestSignInInput = {
        email: String(formData.get("email") ?? ""),
        secret: String(formData.get("secret") ?? ""),
        callbackURL,
      };
      return testSignIn(input);
    },
    null,
  );
  const fieldErrors = fieldErrorsOf(result);
  const formError = formErrorOf(result);
  useFocusFirstInvalid(formRef, result);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-6"
      aria-label="Test sign-in"
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!fieldErrors.email}>
          <FieldLabel htmlFor="test-sign-in-email">Email</FieldLabel>
          <Input
            id="test-sign-in-email"
            name="email"
            type="email"
            autoComplete="off"
            className="h-11 sm:h-9"
            required
            maxLength={254}
            placeholder="you+participant@jahnelgroup.com"
            aria-invalid={!!fieldErrors.email}
          />
          <FieldError>{fieldErrors.email}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.secret}>
          <FieldLabel htmlFor="test-sign-in-secret">Secret</FieldLabel>
          <Input
            id="test-sign-in-secret"
            name="secret"
            type="password"
            autoComplete="off"
            className="h-11 sm:h-9"
            required
            aria-invalid={!!fieldErrors.secret}
          />
          <FieldDescription>
            This server&apos;s TEST_SIGN_IN_SECRET.
          </FieldDescription>
          <FieldError>{fieldErrors.secret}</FieldError>
        </Field>
      </FieldGroup>
      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          size="lg"
          className="min-h-11 self-start sm:min-h-9"
          disabled={pending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        {formError && !pending && <FieldError>{formError}</FieldError>}
      </div>
    </form>
  );
}
