"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  archiveAwardCategory,
  createAwardCategory,
  renameAwardCategory,
  restoreAwardCategory,
} from "@/actions/award-categories";
import {
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
  SetupRowError,
  SetupSaveButton,
  SetupSheetFooter,
  useSetupRow,
} from "@/components/setup-row";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AWARD_CATEGORY_NAME_MAX } from "@/lib/award-categories";
import type { AwardCategoryRow } from "@/queries/award-categories";

/** Add or rename one Award Category, in its Sheet. `onSaved` closes it. */
function CategoryForm({
  category,
  onSaved,
}: {
  /** Set when renaming. */
  category?: AwardCategoryRow;
  onSaved: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(category?.name ?? "");
  const { pending, formRef, formAction, fieldErrors, error } = useSetupRow(
    () =>
      category
        ? renameAwardCategory(category.id, { name })
        : createAwardCategory({ name }),
    category ? "Category renamed" : "Category added",
    onSaved,
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={category ? `Category ${category.name}` : "Category"}
      className="flex flex-col gap-4"
    >
      <Field className="px-4" data-invalid={!!fieldErrors.name}>
        <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
        <Input
          id={`${id}-name`}
          name="name"
          required
          maxLength={AWARD_CATEGORY_NAME_MAX}
          autoComplete="off"
          className="h-11 sm:h-9"
          aria-invalid={!!fieldErrors.name}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError>{fieldErrors.name}</FieldError>
      </Field>
      <SetupSheetFooter>
        <SetupSaveButton
          pending={pending}
          label={category ? "Save" : "Add Category"}
        />
        <SetupRowError error={error} />
      </SetupSheetFooter>
    </form>
  );
}

/** Restores an archived Category: reversible, so no confirm. */
function RestoreButton({ category }: { category: AwardCategoryRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Restore ${category.name}`}
      className="min-h-11 min-w-11 sm:min-h-8"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await restoreAwardCategory(category.id);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Category restored");
          router.refresh();
        })
      }
    >
      Restore
    </Button>
  );
}

/**
 * The global Award Categories: each active one with Rename (a Sheet) and
 * Archive (behind a confirm), then "Add Category", then the archived ones,
 * each with Restore.
 * An archived Category stays on past Awards but can't be picked.
 */
export function AwardCategoriesEditor({
  categories,
}: {
  categories: AwardCategoryRow[];
}) {
  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  const row = (category: AwardCategoryRow) => (
    <SetupListRow
      key={category.id}
      id={category.id}
      label={category.name}
      name={category.name}
      editLabel="Rename"
      aside={
        category.archived ? <RestoreButton category={category} /> : undefined
      }
      form={(close) => <CategoryForm category={category} onSaved={close} />}
      onDelete={
        category.archived ? undefined : () => archiveAwardCategory(category.id)
      }
      deleteLabel="Archive"
      deleteTitle={`Archive "${category.name}"?`}
      deleteDescription="It stays on the Awards that have it, but can't be picked for other Awards."
      deleteSuccess="Category archived"
    />
  );

  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      {active.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Categories yet.</p>
      ) : (
        <ul aria-label="Award Categories">{active.map(row)}</ul>
      )}
      <SetupAddButton
        label="Add Category"
        form={(close) => <CategoryForm onSaved={close} />}
      />
      {archived.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-foreground/70 text-sm font-semibold">Archived</h3>
          <ul aria-label="Archived Award Categories">{archived.map(row)}</ul>
        </div>
      )}
    </div>
  );
}
