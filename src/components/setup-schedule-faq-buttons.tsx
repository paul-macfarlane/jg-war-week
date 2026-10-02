"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  type SetupScheduleFaqActionResult,
  moveFaqItem,
} from "@/actions/setup-schedule-faq";
import { Button } from "@/components/ui/button";

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
    <>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 min-w-11 sm:min-h-8"
        disabled={pending || first}
        aria-label={`Move "${question}" up`}
        onClick={() => run(() => moveFaqItem(id, "up"))}
      >
        ↑
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 min-w-11 sm:min-h-8"
        disabled={pending || last}
        aria-label={`Move "${question}" down`}
        onClick={() => run(() => moveFaqItem(id, "down"))}
      >
        ↓
      </Button>
    </>
  );
}
