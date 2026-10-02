"use client";

import { deleteFaqItem } from "@/actions/setup-schedule-faq";
import { FaqItemForm } from "@/components/faq-item-form";
import {
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
} from "@/components/setup-row";
import { MoveFaqItemButtons } from "@/components/setup-schedule-faq-buttons";
import type { Content } from "@/lib/rich-text/content";

/**
 * The FAQ Items in their public order, each with its up and down buttons,
 * Edit (the form in a Sheet) and Delete, then "Add FAQ Item".
 */
export function FaqEditor({
  warWeekId,
  items,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /** Each answer already sanitized for the editor. */
  items: { id: string; question: string; answer: Content }[];
}) {
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="text-foreground/70 text-sm">No FAQ Items yet.</p>
      ) : (
        <ol aria-label="FAQ Items">
          {items.map((item, index) => (
            <SetupListRow
              key={item.id}
              id={item.id}
              name={item.question}
              aside={
                <MoveFaqItemButtons
                  id={item.id}
                  question={item.question}
                  first={index === 0}
                  last={index === items.length - 1}
                />
              }
              form={(close) => (
                <FaqItemForm
                  warWeekId={warWeekId}
                  itemId={item.id}
                  initial={{ question: item.question, answer: item.answer }}
                  onSaved={close}
                />
              )}
              onDelete={() => deleteFaqItem(item.id)}
              deleteTitle={`Delete "${item.question}"?`}
              deleteSuccess="FAQ Item deleted"
            />
          ))}
        </ol>
      )}
      <SetupAddButton
        label="Add FAQ Item"
        form={(close) => <FaqItemForm warWeekId={warWeekId} onSaved={close} />}
      />
    </div>
  );
}
