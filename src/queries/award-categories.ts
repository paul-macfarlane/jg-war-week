import { asc } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { awardCategory } from "@/db/schema";

export type AwardCategoryRow = {
  id: string;
  name: string;
  archived: boolean;
};

/** Every Award Category by name, archived ones included (flagged). */
export async function getAwardCategories(
  dbOrTx: DBOrTx = db,
): Promise<AwardCategoryRow[]> {
  const rows = await dbOrTx
    .select({
      id: awardCategory.id,
      name: awardCategory.name,
      archivedAt: awardCategory.archivedAt,
    })
    .from(awardCategory)
    .orderBy(asc(awardCategory.name), asc(awardCategory.id));
  return rows.map(({ id, name, archivedAt }) => ({
    id,
    name,
    archived: archivedAt !== null,
  }));
}
