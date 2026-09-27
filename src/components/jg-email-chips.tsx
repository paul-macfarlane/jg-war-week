"use client";

import { XIcon } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parseEmailEntry } from "@/lib/email-entry";

/**
 * A list of Jahnel Group emails as removable chips. Enter, a comma or
 * pasting a list adds them; addresses outside @jahnelgroup.com are refused
 * inline and left in the box to fix. The server re-validates whatever is
 * saved.
 */
export function JgEmailChips({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const inputId = `${id}-input`;
  const helpId = `${id}-help`;
  const [draft, setDraft] = useState("");
  const [rejected, setRejected] = useState<string[]>([]);

  function add(text: string) {
    const entry = parseEmailEntry(text);
    const known = new Set(value.map((email) => email.toLowerCase()));
    const added = entry.accepted.filter((email) => !known.has(email));
    if (added.length > 0) onChange([...value, ...added]);
    setRejected(entry.rejected);
    setDraft(entry.rejected.join(", "));
  }

  function remove(email: string) {
    const target = email.toLowerCase();
    onChange(value.filter((e) => e.toLowerCase() !== target));
  }

  return (
    <Field>
      <FieldLabel id={labelId} htmlFor={inputId}>
        {label}
      </FieldLabel>
      {value.length > 0 && (
        <ul aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
          {value.map((email) => (
            <li key={email} className="max-w-full">
              <Badge
                variant="secondary"
                className="h-7 max-w-full gap-0.5 pr-0.5 pl-2.5 text-sm"
              >
                <span className="truncate">{email}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-full"
                  aria-label={`Remove ${email}`}
                  disabled={disabled}
                  onClick={() => remove(email)}
                >
                  <XIcon />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={inputId}
        aria-labelledby={labelId}
        aria-describedby={helpId}
        type="text"
        inputMode="email"
        autoComplete="off"
        placeholder="name@jahnelgroup.com"
        className="border-border h-11 sm:h-9"
        value={draft}
        disabled={disabled}
        aria-invalid={rejected.length > 0 || undefined}
        onChange={(event) => {
          const text = event.target.value;
          if (text.includes(",")) add(text);
          else {
            setDraft(text);
            setRejected([]);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(draft);
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const pasted = event.clipboardData.getData("text");
          const input = event.currentTarget;
          const start = input.selectionStart ?? draft.length;
          const end = input.selectionEnd ?? draft.length;
          const combined = draft.slice(0, start) + pasted + draft.slice(end);
          if (/[\s,]/.test(combined)) add(combined);
          else setDraft(combined);
        }}
        onBlur={() => {
          if (draft.trim()) add(draft);
        }}
      />
      {rejected.length > 0 && (
        <FieldError>
          Only @jahnelgroup.com addresses can be added: {rejected.join(", ")}
        </FieldError>
      )}
      <FieldDescription id={helpId}>
        Press Enter or a comma to add, or paste a list.
        {description ? ` ${description}` : ""}
      </FieldDescription>
    </Field>
  );
}
