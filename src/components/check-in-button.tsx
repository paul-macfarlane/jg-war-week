"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { toast } from "sonner";

import { checkIn, checkOut } from "@/actions/participation";
import { Button } from "@/components/ui/button";

/**
 * What the linked Participant may do about checking in, worked out on the
 * server with the Check in rule (ADR 0009). `reason` is the rule's refusal
 * when the action is unavailable, null when it's open.
 */
export type CheckInOffer = {
  competitionId: string;
  checkedIn: boolean;
  reason: string | null;
};

/** Check in, or Check out of your own check-in; disabled with the reason when unavailable. */
export function CheckInButton({ offer }: { offer: CheckInOffer }) {
  const router = useRouter();
  const reasonId = useId();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = offer.checkedIn
        ? await checkOut(offer.competitionId)
        : await checkIn(offer.competitionId);
      if (result.ok) {
        toast.success(offer.checkedIn ? "Checked out" : "You're checked in");
      } else {
        toast.error(result.error);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {offer.checkedIn ? (
        <p className="text-sm font-medium">You&apos;re checked in.</p>
      ) : null}
      <Button
        type="button"
        variant={offer.checkedIn ? "outline" : "default"}
        className="min-h-11 w-full sm:min-h-9 sm:w-auto sm:self-start"
        disabled={pending || offer.reason !== null}
        aria-describedby={offer.reason ? reasonId : undefined}
        onClick={run}
      >
        {offer.checkedIn ? "Check out" : "Check in"}
      </Button>
      {offer.reason ? (
        <p id={reasonId} className="text-foreground/70 text-sm">
          {offer.reason}
        </p>
      ) : null}
    </div>
  );
}
