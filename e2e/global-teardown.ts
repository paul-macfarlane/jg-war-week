import { deleteE2eUsers } from "./db";

/** Removes the e2e users, their sessions and their Organizer rows. */
export default async function globalTeardown() {
  await deleteE2eUsers();
}
