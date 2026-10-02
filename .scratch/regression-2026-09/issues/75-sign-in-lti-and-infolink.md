# 75: Sign in with LTI and InfoLink emails

**What to build:** Let people with LTI and InfoLink email addresses sign in, alongside `@jahnelgroup.com`.

**Blocked by:** none

**Status:** needs-info

**Source:** Paul's regression feedback 2026-10-01, P8

## Notes

- Waiting on: the exact domains (Paul doesn't have them yet), and whether those accounts are Google Workspace (sign-in is Google-only).
- Today the domain lives in one constant (`JG_EMAIL_DOMAIN`, `src/lib/access.ts`) but is also in Google's `hd` hint (one domain only, so it would be dropped and the server hooks relied on), `jgEmailSchema`, `proxy.ts`, and copy on Privacy, Terms, About, the Organizer guide and `llms.txt`. An env-var allowlist is the likely shape.
- Can those users be Organizers or Hosts, or only Participants? Decide when grilled.
- Auth change: red-team.

## Acceptance criteria

- [ ] Domains known and the role question answered; then becomes `ready-for-agent`.
