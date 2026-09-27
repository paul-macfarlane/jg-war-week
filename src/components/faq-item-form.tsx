"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type SetupScheduleFaqActionResult,
  createFaqItem,
  updateFaqItem,
} from "@/actions/setup-schedule-faq";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Content } from "@/lib/rich-text/content";

const EMPTY_ANSWER: Content = { type: "doc", content: [] };

const BACK = "/admin/setup/faq";

/** Add or edit one FAQ Item: a question and its rich-text answer. */
export function FaqItemForm({
  warWeekId,
  itemId,
  initial,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /** Set when editing an existing FAQ Item. */
  itemId?: string;
  initial?: { question: string; answer: Content };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState<Content>(
    initial?.answer ?? EMPTY_ANSWER,
  );

  // Validation runs on the server; a refusal names its fields. Every field
  // is closed over from state (rather than read off `FormData`) so the
  // rich-text answer survives a refusal unchanged.
  const [result, formAction, pending] = useActionState(
    async (): Promise<SetupScheduleFaqActionResult> => {
      const input = { question, answer };
      const saved = itemId
        ? await updateFaqItem(itemId, input)
        : await createFaqItem(warWeekId, input);
      if (!saved.ok) {
        toast.error(saved.error);
        return saved;
      }
      toast.success("FAQ Item saved");
      router.push(BACK);
      router.refresh();
      return saved;
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
      className="flex flex-col gap-5"
      aria-label="FAQ Item"
    >
      <FieldGroup>
        <Field data-invalid={!!fieldErrors.question}>
          <FieldLabel htmlFor="faq-question">Question</FieldLabel>
          <Input
            id="faq-question"
            name="question"
            required
            maxLength={300}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.question}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <FieldError>{fieldErrors.question}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.answer}>
          <FieldLabel id="faq-answer-label">Answer</FieldLabel>
          <RichTextEditor
            content={answer}
            onChange={setAnswer}
            label="Answer"
            labelId="faq-answer-label"
          />
          <FieldError>{fieldErrors.answer}</FieldError>
        </Field>
      </FieldGroup>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="lg"
          className="min-h-11 sm:min-h-9"
          disabled={pending}
        >
          {pending ? "Saving…" : itemId ? "Save changes" : "Add FAQ Item"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 sm:min-h-9"
          onClick={() => router.push(BACK)}
        >
          Cancel
        </Button>
      </div>
      {formError && !pending && <FieldError>{formError}</FieldError>}
    </form>
  );
}
