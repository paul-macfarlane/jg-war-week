/** The name the account menu shows when no roster name is known: the email's local part. */
export function nameFromEmail(email: string): string {
  return email.split("@")[0] || email;
}
