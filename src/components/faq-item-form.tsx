"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type SetupScheduleFaqActionResult,
  createFaqItem,
  updateFaqItem,
} from "@/actions/setup-schedule-faq";
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
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState<Content>(
    initial?.answer ?? EMPTY_ANSWER,
  );
  const [result, setResult] = useState<SetupScheduleFaqActionResult | null>(
    null,
  );

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { question, answer };
    startTransition(async () => {
      const saved = itemId
        ? await updateFaqItem(itemId, input)
        : await createFaqItem(warWeekId, input);
      setResult(saved);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      toast.success("FAQ Item saved");
      router.push(BACK);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5"
      aria-label="FAQ Item"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="faq-question">Question</FieldLabel>
          <Input
            id="faq-question"
            name="question"
            required
            maxLength={300}
            className="h-11 sm:h-9"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel>Answer</FieldLabel>
          <RichTextEditor
            content={answer}
            onChange={setAnswer}
            label="Answer"
          />
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
      {result && !result.ok && !pending && (
        <FieldError>{result.error}</FieldError>
      )}
    </form>
  );
}
