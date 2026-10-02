"use client";

import { UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { importParticipants } from "@/actions/setup";
import {
  ResponsiveSheetDialog,
  ResponsiveSheetDialogDescription,
  ResponsiveSheetDialogHeader,
  ResponsiveSheetDialogTitle,
} from "@/components/responsive-sheet-dialog";
import { SetupRowError, SetupSheetFooter } from "@/components/setup-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { WarWeek } from "@/db/schema";
import {
  MAX_IMPORT_BYTES,
  type RosterImportEntry,
  type RosterImportPlan,
  importedMessage,
  planCounts,
  planRosterText,
  planSignature,
} from "@/lib/roster-import";
import type { SetupParticipant, SetupTeam } from "@/queries/setup";

const KIND_LABEL: Record<RosterImportEntry["kind"], string> = {
  add: "Add",
  update: "Update",
  unchanged: "Unchanged",
  error: "Error",
};

const KIND_VARIANT = {
  add: "default",
  update: "secondary",
  unchanged: "outline",
  error: "destructive",
} as const;

function KindBadge({ kind }: { kind: RosterImportEntry["kind"] }) {
  return <Badge variant={KIND_VARIANT[kind]}>{KIND_LABEL[kind]}</Badge>;
}

/**
 * What a row's import does: an Update's changes, one per line, a cleared
 * field ("Team: Red → none") in bold so it isn't missed; an Error's reason.
 */
function EntryDetails({ entry }: { entry: RosterImportEntry }) {
  if (entry.kind === "error") {
    return <span className="text-destructive">{entry.error}</span>;
  }
  if (entry.kind === "update") {
    return (
      <ul className="flex flex-col">
        {entry.changes.map((change) => (
          <li
            key={change}
            className={
              change.endsWith("→ none") ? "text-destructive font-semibold" : ""
            }
          >
            {change}
          </li>
        ))}
      </ul>
    );
  }
  if (entry.kind === "unchanged") {
    return <span className="text-foreground/60">Nothing changes</span>;
  }
  return null;
}

/** The preview: cards on phones, a table from `md`. */
function PlanPreview({ entries }: { entries: RosterImportEntry[] }) {
  const counts = planCounts(entries);
  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="font-medium">
        {counts.add} to add, {counts.update} to update, {counts.error}{" "}
        {counts.error === 1 ? "error" : "errors"}
        {counts.unchanged > 0 && `, ${counts.unchanged} unchanged`}
      </p>
      <ul aria-label="Import preview" className="flex flex-col gap-2 md:hidden">
        {entries.map((entry) => (
          <li key={entry.row}>
            <Card size="sm">
              <CardContent className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 font-medium break-words">
                    {entry.name || "(no name)"}
                  </span>
                  <KindBadge kind={entry.kind} />
                </div>
                <span className="text-foreground/60 text-xs">
                  Row {entry.row}
                </span>
                <div className="text-xs">
                  <EntryDetails entry={entry} />
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Table aria-label="Import preview">
          <TableHeader>
            <TableRow>
              <TableHead>Row</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.row}>
                <TableCell>{entry.row}</TableCell>
                <TableCell className="whitespace-normal">
                  {entry.name || "(no name)"}
                </TableCell>
                <TableCell>
                  <KindBadge kind={entry.kind} />
                </TableCell>
                <TableCell className="text-xs whitespace-normal">
                  <EntryDetails entry={entry} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * The roster's **Import**: a Sheet where an Organizer pastes cells from
 * Google Sheets or uploads a CSV, previews each row as Add, Update,
 * Unchanged or Error, then imports the Adds and Updates in one go
 * (ticket 67).
 */
export function RosterImport({
  warWeekId,
  participants,
  teams,
  mode,
  teamLabel,
  leaderTitle,
}: {
  warWeekId: string;
  participants: SetupParticipant[];
  teams: SetupTeam[];
  mode: WarWeek["mode"];
  teamLabel: string;
  leaderTitle: string;
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<RosterImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isTeams = mode === "teams";
  const columnHint = isTeams
    ? `Columns: name, email, ${teamLabel}, company tag, ${leaderTitle}. A header row may name them instead.`
    : "Columns: name, email, company tag. A header row may name them instead.";

  function openChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setText("");
      setPlan(null);
      setError(null);
    }
  }

  function changeText(next: string) {
    setText(next);
    setPlan(null);
    setError(null);
  }

  async function readFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error("That file is over 256 KB. Import fewer rows at a time.");
      event.target.value = "";
      return;
    }
    changeText(await file.text());
  }

  function preview() {
    setPlan(
      planRosterText(text, {
        roster: participants,
        teams: isTeams ? teams : [],
        mode,
        teamLabel,
        leaderTitle,
      }),
    );
  }

  const entries = plan?.ok ? plan.entries : [];
  const counts = planCounts(entries);
  const canImport = counts.add + counts.update > 0;

  function runImport() {
    if (!plan?.ok) return;
    startTransition(async () => {
      const result = await importParticipants(warWeekId, {
        text,
        expected: planSignature(plan.entries),
      });
      if (!result.ok) {
        toast.error(result.error);
        setError(result.error);
        return;
      }
      toast.success(importedMessage(result));
      openChange(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="min-h-11 sm:min-h-9"
        onClick={() => setOpen(true)}
      >
        <UploadIcon />
        Import
      </Button>
      <ResponsiveSheetDialog open={open} onOpenChange={openChange}>
        {open ? (
          <>
            <ResponsiveSheetDialogHeader>
              <ResponsiveSheetDialogTitle>
                Import Participants
              </ResponsiveSheetDialogTitle>
              <ResponsiveSheetDialogDescription>
                A row whose email is already on the roster updates that
                Participant; any other row adds one.
              </ResponsiveSheetDialogDescription>
            </ResponsiveSheetDialogHeader>
            <FieldGroup className="gap-4 px-4">
              <Field>
                <FieldLabel htmlFor={`${id}-paste`}>
                  Paste from Google Sheets
                </FieldLabel>
                <Textarea
                  id={`${id}-paste`}
                  rows={6}
                  className="max-h-60 font-mono text-xs md:text-xs"
                  value={text}
                  onChange={(event) => changeText(event.target.value)}
                />
                <FieldDescription>{columnHint}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-file`}>Or upload a CSV</FieldLabel>
                <Input
                  id={`${id}-file`}
                  type="file"
                  accept=".csv,text/csv"
                  className="h-11 sm:h-9"
                  onChange={readFile}
                />
              </Field>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="min-h-11 self-start sm:min-h-9"
                onClick={preview}
              >
                Preview
              </Button>
              {plan &&
                (plan.ok ? (
                  <PlanPreview entries={plan.entries} />
                ) : (
                  <FieldError>{plan.error}</FieldError>
                ))}
            </FieldGroup>
            <SetupSheetFooter>
              <Button
                type="button"
                size="lg"
                className="min-h-11 sm:min-h-9"
                disabled={!canImport || pending}
                onClick={runImport}
              >
                {pending ? "Importing…" : "Import"}
              </Button>
              <SetupRowError error={pending ? null : error} />
            </SetupSheetFooter>
          </>
        ) : null}
      </ResponsiveSheetDialog>
    </>
  );
}
