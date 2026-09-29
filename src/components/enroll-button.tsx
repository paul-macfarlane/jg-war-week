"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { enroll, joinSquad, leaveSquad, withdraw } from "@/actions/enrollment";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WriteResult } from "@/lib/result";

/** The Squad help line (Enrollment rules), shown wherever Squads appear. */
export const SQUAD_HELP =
  "a pair or group from one Team, playing as one entrant";

/**
 * What the linked Participant may do about entering this Competition,
 * worked out on the server with the enrollment rules. `reason` is the
 * rule's refusal when the action is unavailable, null when it's open.
 */
export type EnrollOffer = {
  competitionId: string;
  competitionName: string;
  scoring: "team" | "individual";
  /** Enroll or Withdraw the Participant (or their Team); null in a Squads Bracket. */
  entrant: { entered: boolean; reason: string | null } | null;
  /** Join or Leave, per Squad of the viewer's Team; null without Squads. */
  squads:
    | {
        id: string;
        name: string;
        joined: boolean;
        reason: string | null;
      }[]
    | null;
};

function useWrite() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(
    action: () => Promise<WriteResult>,
    success: string,
    done?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
      done?.();
      router.refresh();
    });
  }
  return { pending, run };
}

/** A button, disabled with the rule's reason under it when unavailable. */
function OfferButton({
  label,
  reason,
  pending,
  variant = "default",
  onClick,
}: {
  label: string;
  reason: string | null;
  pending: boolean;
  variant?: "default" | "outline";
  onClick: () => void;
}) {
  const reasonId = useId();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        className="min-h-11 w-full sm:min-h-9 sm:w-auto sm:self-start"
        disabled={pending || reason !== null}
        aria-describedby={reason ? reasonId : undefined}
        onClick={onClick}
      >
        {label}
      </Button>
      {reason ? (
        <p id={reasonId} className="text-foreground/70 text-sm">
          {reason}
        </p>
      ) : null}
    </div>
  );
}

function EntrantOffer({
  offer,
  entrant,
}: {
  offer: EnrollOffer;
  entrant: NonNullable<EnrollOffer["entrant"]>;
}) {
  const { pending, run } = useWrite();
  const [confirming, setConfirming] = useState(false);
  const team = offer.scoring === "team";

  if (!entrant.entered) {
    return (
      <OfferButton
        label="Enroll"
        reason={entrant.reason}
        pending={pending}
        onClick={() =>
          run(
            () => enroll(offer.competitionId),
            team ? "Your Team is enrolled" : "You're enrolled",
          )
        }
      />
    );
  }
  return (
    <>
      <p className="text-sm font-medium">
        {team ? "Your Team is entered." : "You're entered."}
      </p>
      <OfferButton
        label="Withdraw"
        variant="outline"
        reason={entrant.reason}
        pending={pending}
        onClick={() => setConfirming(true)}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          team
            ? `Withdraw your Team from ${offer.competitionName}?`
            : `Withdraw from ${offer.competitionName}?`
        }
        description="You can enroll again until enrollment closes."
        confirmLabel="Withdraw"
        pending={pending}
        onConfirm={() =>
          run(
            () => withdraw(offer.competitionId),
            team ? "Your Team has withdrawn" : "You've withdrawn",
            () => setConfirming(false),
          )
        }
      />
    </>
  );
}

function SquadOffers({
  offer,
  squads,
}: {
  offer: EnrollOffer;
  squads: NonNullable<EnrollOffer["squads"]>;
}) {
  const { pending, run } = useWrite();
  const [leaving, setLeaving] = useState<{ id: string; name: string } | null>(
    null,
  );
  const joined = squads.find((s) => s.joined);
  // In a Squad already: only Leave it; the other Joins would all refuse.
  const shown = joined ? [joined] : squads;

  return (
    <>
      <p className="text-foreground/70 text-sm">
        <span className="font-medium">Squad</span>: {SQUAD_HELP}
      </p>
      {squads.length === 0 ? (
        <p className="text-foreground/70 text-sm">
          Your Team has no Squad in this Competition yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((squad) => (
            <li key={squad.id}>
              {squad.joined ? (
                <OfferButton
                  label={`Leave ${squad.name}`}
                  variant="outline"
                  reason={squad.reason}
                  pending={pending}
                  onClick={() => setLeaving(squad)}
                />
              ) : (
                <OfferButton
                  label={`Join ${squad.name}`}
                  reason={squad.reason}
                  pending={pending}
                  onClick={() =>
                    run(
                      () => joinSquad(offer.competitionId, squad.id),
                      `You joined ${squad.name}`,
                    )
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={leaving !== null}
        onOpenChange={(open) => {
          if (!open) setLeaving(null);
        }}
        title={`Leave ${leaving?.name ?? "this Squad"}?`}
        description="You can join a Squad again until enrollment closes."
        confirmLabel="Leave"
        pending={pending}
        onConfirm={() => {
          if (!leaving) return;
          run(
            () => leaveSquad(offer.competitionId, leaving.id),
            `You left ${leaving.name}`,
            () => setLeaving(null),
          );
        }}
      />
    </>
  );
}

/**
 * Self-enrollment on a Competition page (ADR 0006), for a linked
 * Participant only: Enroll or Withdraw (behind a confirm), or in a Squads
 * Bracket Join or Leave one of their Team's Squads. An unavailable action
 * shows the rule's reason. Results and refusals toast.
 */
export function EnrollButton({ offer }: { offer: EnrollOffer }) {
  return (
    <Card size="sm" className="gap-3 px-4">
      <h2 className="text-lg font-semibold">Enrollment</h2>
      {offer.entrant ? (
        <EntrantOffer offer={offer} entrant={offer.entrant} />
      ) : null}
      {offer.squads ? (
        <SquadOffers offer={offer} squads={offer.squads} />
      ) : null}
    </Card>
  );
}
