"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { logGame, updateGame } from "@/actions/games";
import {
  EntityCombobox,
  type EntityComboboxItem,
} from "@/components/entity-combobox";
import {
  ResponsiveSheetDialog,
  ResponsiveSheetDialogDescription,
  ResponsiveSheetDialogFooter,
  ResponsiveSheetDialogHeader,
  ResponsiveSheetDialogTitle,
} from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { GameFormat } from "@/lib/enums";
import {
  type BestScoreConfig,
  type GamesConfig,
  type HeadToHeadConfig,
  resultNoun,
} from "@/lib/games/config";
import type { FieldErrors } from "@/lib/result";
import type { GamesViewName, GamesViewPlayer } from "@/queries/games";

type Scoring = "team" | "individual";
/** Who won a head-to-head Game: Player A, Player B, or a draw. */
type Outcome = "a" | "b" | "draw";
type Linked = { participantId: string; teamId: string | null } | null;

/** A Game being edited: its id and its players with places and scores. */
export type ResultFormGame = { id: string; players: GamesViewPlayer[] };

export type ResultFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  gameFormat: GameFormat;
  config: GamesConfig;
  scoring: Scoring;
  /** Who may play: names and ids only. */
  entrantOptions: GamesViewName[];
  /** The viewer's linked Participant, preselected as a player when listed. */
  linked: Linked;
  /** The Game to edit, or null to log a new one. */
  game: ResultFormGame | null;
};

/**
 * Logging or editing a Game, in a bottom Sheet (a centered Dialog on large
 * screens), per Format: head-to-head takes two players and who won;
 * best-score one player and a score; ranked every player with a place.
 * The result toasts; a refusal toasts the server's message and keeps the
 * form open with its input.
 */
export function ResultForm(props: ResultFormProps) {
  const { open, onOpenChange, game } = props;
  return (
    <ResponsiveSheetDialog open={open} onOpenChange={onOpenChange}>
      {open ? <ResultFormBody key={game?.id ?? "new"} {...props} /> : null}
    </ResponsiveSheetDialog>
  );
}

function fieldErrorsFrom(result: { ok: boolean }): FieldErrors {
  return (result as { fieldErrors?: FieldErrors }).fieldErrors ?? {};
}

/** The viewer's own player id (their Team in a team Competition), if offered. */
function youIn(
  scoring: Scoring,
  linked: Linked,
  options: GamesViewName[],
): string {
  const id = linked
    ? scoring === "team"
      ? linked.teamId
      : linked.participantId
    : null;
  return id && options.some((o) => o.id === id) ? id : "";
}

type Row = { key: number; id: string; place: string };

function ResultFormBody({
  onOpenChange,
  competitionId,
  gameFormat,
  config,
  scoring,
  entrantOptions,
  linked,
  game,
}: ResultFormProps) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const items: EntityComboboxItem[] = entrantOptions.map((o) => ({
    id: o.id,
    label: o.name,
  }));
  const nameOf = (playerId: string) =>
    entrantOptions.find((o) => o.id === playerId)?.name ?? null;
  const you = youIn(scoring, linked, entrantOptions);
  const players = game?.players ?? [];

  // Head-to-head.
  const [playerA, setPlayerA] = useState(players[0]?.id ?? you);
  const [playerB, setPlayerB] = useState(players[1]?.id ?? "");
  const [outcome, setOutcome] = useState<Outcome | "">(() => {
    if (players.length !== 2) return "";
    if (players[0].place === players[1].place) return "draw";
    return players[0].place === 1 ? "a" : "b";
  });
  // Best-score.
  const [player, setPlayer] = useState(players[0]?.id ?? you);
  const [score, setScore] = useState(
    players[0]?.score === null || players[0]?.score === undefined
      ? ""
      : String(players[0].score),
  );
  // Ranked.
  const [rows, setRows] = useState<Row[]>(() =>
    players.length > 0
      ? [...players]
          .sort((a, b) => (a.place ?? 0) - (b.place ?? 0))
          .map((p, i) => ({ key: i, id: p.id, place: String(p.place ?? "") }))
      : [
          { key: 0, id: you, place: "1" },
          { key: 1, id: "", place: "2" },
        ],
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const noun = resultNoun(gameFormat);

  function raw(): Record<string, unknown> {
    if (gameFormat === "head-to-head") return { playerA, playerB, outcome };
    if (gameFormat === "best-score") return { player, score };
    return {
      order: rows
        .filter((r) => r.id)
        .map((r) => ({ id: r.id, place: Number(r.place) })),
    };
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = raw();
    startTransition(async () => {
      const result = game
        ? await updateGame(competitionId, game.id, input)
        : await logGame(competitionId, input);
      if (!result.ok) {
        setErrors(fieldErrorsFrom(result));
        toast.error(result.error);
        return;
      }
      toast.success(game ? `${noun.one} updated` : `${noun.one} logged`);
      onOpenChange(false);
      router.refresh();
    });
  }

  const drawsAllowed =
    gameFormat === "head-to-head" && (config as HeadToHeadConfig).drawsAllowed;
  const unit =
    gameFormat === "best-score" ? (config as BestScoreConfig).unit : "";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>
          {game ? `Edit ${noun.one}` : `Log ${noun.a}`}
        </ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          {gameFormat === "head-to-head"
            ? "Choose both players and who won."
            : gameFormat === "best-score"
              ? "Choose the player and their score."
              : "List everyone who played, with their place. Players who tie share a place."}
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <FieldGroup className="gap-4 px-4">
        {gameFormat === "head-to-head" ? (
          <>
            <Field data-invalid={Boolean(errors.playerA)}>
              <FieldLabel htmlFor={`${id}-a`}>Player A</FieldLabel>
              <EntityCombobox
                id={`${id}-a`}
                items={items}
                value={playerA}
                onValueChange={setPlayerA}
                placeholder="Choose a player"
                aria-invalid={Boolean(errors.playerA)}
              />
              <FieldError>{errors.playerA}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.playerB)}>
              <FieldLabel htmlFor={`${id}-b`}>Player B</FieldLabel>
              <EntityCombobox
                id={`${id}-b`}
                items={items}
                value={playerB}
                onValueChange={setPlayerB}
                placeholder="Choose a player"
                aria-invalid={Boolean(errors.playerB)}
              />
              <FieldError>{errors.playerB}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.outcome)}>
              <span id={`${id}-outcome`} className="text-sm font-medium">
                Who won?
              </span>
              <ToggleGroup
                aria-labelledby={`${id}-outcome`}
                value={outcome ? [outcome] : []}
                onValueChange={(value) => {
                  // A choice can't be deselected: clicking the pressed item
                  // again would otherwise clear the group.
                  const [next] = value as Outcome[];
                  if (next) setOutcome(next);
                }}
                variant="outline"
                className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3"
              >
                {(
                  [
                    ["a", `${nameOf(playerA) ?? "Player A"} won`],
                    ["b", `${nameOf(playerB) ?? "Player B"} won`],
                    ...(drawsAllowed ? [["draw", "Draw"]] : []),
                  ] as [Outcome, string][]
                ).map(([value, label]) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80 h-auto min-h-11 py-2 whitespace-normal sm:min-h-9"
                  >
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldError>{errors.outcome}</FieldError>
            </Field>
          </>
        ) : gameFormat === "best-score" ? (
          <>
            <Field data-invalid={Boolean(errors.player)}>
              <FieldLabel htmlFor={`${id}-player`}>Player</FieldLabel>
              <EntityCombobox
                id={`${id}-player`}
                items={items}
                value={player}
                onValueChange={setPlayer}
                placeholder="Choose a player"
                aria-invalid={Boolean(errors.player)}
              />
              <FieldError>{errors.player}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.score)}>
              <FieldLabel htmlFor={`${id}-score`}>
                {unit ? `Score (${unit})` : "Score"}
              </FieldLabel>
              <Input
                id={`${id}-score`}
                inputMode="decimal"
                className="h-11 sm:h-9"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                aria-invalid={Boolean(errors.score)}
              />
              <FieldError>{errors.score}</FieldError>
            </Field>
          </>
        ) : (
          <Field data-invalid={Boolean(errors.order)}>
            <ol className="flex flex-col gap-3">
              {rows.map((row, i) => (
                <li key={row.key} className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <FieldLabel htmlFor={`${id}-row-${row.key}`}>
                      Player {i + 1}
                    </FieldLabel>
                    <EntityCombobox
                      id={`${id}-row-${row.key}`}
                      items={items}
                      value={row.id}
                      onValueChange={(value) =>
                        setRows((rs) =>
                          rs.map((r) =>
                            r.key === row.key ? { ...r, id: value } : r,
                          ),
                        )
                      }
                      placeholder="Choose a player"
                    />
                  </div>
                  <div className="flex w-20 flex-col gap-1">
                    <FieldLabel htmlFor={`${id}-place-${row.key}`}>
                      Place
                    </FieldLabel>
                    <Input
                      id={`${id}-place-${row.key}`}
                      aria-label={`Place of player ${i + 1}`}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className="h-11 sm:h-9"
                      value={row.place}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((r) =>
                            r.key === row.key
                              ? { ...r, place: e.target.value }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove player ${i + 1}`}
                    className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9"
                    disabled={rows.length <= 2}
                    onClick={() =>
                      setRows((rs) => rs.filter((r) => r.key !== row.key))
                    }
                  >
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-fit sm:min-h-9"
              onClick={() => {
                setRows((rs) => [
                  ...rs,
                  { key: nextKey, id: "", place: String(rs.length + 1) },
                ]);
                setNextKey((k) => k + 1);
              }}
            >
              Add player
            </Button>
            <FieldError>{errors.order}</FieldError>
          </Field>
        )}
      </FieldGroup>
      <ResponsiveSheetDialogFooter>
        <Button type="submit" size="lg" className="min-h-11" disabled={pending}>
          {pending ? "Saving…" : game ? `Save ${noun.one}` : `Log ${noun.one}`}
        </Button>
      </ResponsiveSheetDialogFooter>
    </form>
  );
}
