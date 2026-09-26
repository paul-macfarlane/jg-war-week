/** Reading JG emails typed or pasted into the email-chips control. */
import { isJahnelGroupEmail } from "@/lib/access";

const SEPARATORS = /[\s,]+/;

/**
 * Reads what was typed or pasted into the chip input: split on whitespace
 * and commas, lowercased and deduped. Only @jahnelgroup.com addresses are
 * accepted; the rest come back as typed so the error can name them.
 */
export function parseEmailEntry(text: string): {
  accepted: string[];
  rejected: string[];
} {
  const accepted = new Set<string>();
  const rejected = new Set<string>();
  for (const entry of text.split(SEPARATORS).filter(Boolean)) {
    if (isJahnelGroupEmail(entry)) accepted.add(entry.toLowerCase());
    else rejected.add(entry);
  }
  return { accepted: [...accepted], rejected: [...rejected] };
}
