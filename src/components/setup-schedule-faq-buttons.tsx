"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  type SetupScheduleFaqActionResult,
  moveFaqItem,
} from "@/actions/setup-schedule-faq";
import { MoveUpDownButtons } from "@/components/setup-row";

/** Runs an action, toasting its refusal, then refreshes the page. */
function useRefreshingAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<SetupScheduleFaqActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }
  return { pending, run };
}

/** Up and down buttons for one FAQ Item; an end's button is disabled. */
export function MoveFaqItemButtons({
  id,
  question,
  first,
  last,
}: {
  id: string;
  question: string;
  first: boolean;
  last: boolean;
}) {
  const { pending, run } = useRefreshingAction();
  return (
    <MoveUpDownButtons
      label={question}
      first={first}
      last={last}
      disabled={pending}
      onMove={(direction) => run(() => moveFaqItem(id, direction))}
    />
  );
}
