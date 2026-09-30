# 20: Move JG War Week to Jahnel Group ownership

**What to build:** Mostly nothing: move every account and resource the app runs on out of Paul's personal accounts into Jahnel Group-owned ones, so the app outlives any one person's access.

**Blocked by:** none

**Status:** needs-triage

**Source:** Paul, 2026-09-30

## Need

- **Organizer / maintainer:** JG War Week runs on Paul's personal projects. If Paul is unavailable, Jason and future maintainers can't deploy, roll back, rotate secrets or renew the domain (`docs/maintainers-guide.md` access table lists Paul for most of them).

## Scope to confirm in triage

- **GitHub:** transfer `paul-macfarlane/jg-war-week` to a JG org (redirects keep old links working; Actions secrets, environments and branch protection need re-checking).
- **Vercel:** transfer the project to a JG team (plan and cost owner, env vars, preview/production domains, Deployment Protection).
- **Neon:** move the project (staging and production branches) to a JG org, or restore into a new JG-owned project; update `DATABASE_URL` everywhere without data loss.
- **GCP:** the Google OAuth client and consent screen move to a JG-owned GCP project; the redirect URIs and `BETTER_AUTH_*` / Google client env vars change.
- **Domain:** transfer the registrar account for the `jg-war-week` domain (and DNS) to JG.
- **Anything else** holding a secret or a bill: MCP token, Slack webhook (ticket `war-weeker/15`), AI keys if any.
- Update `docs/maintainers-guide.md` (access table, who to ask), `.env.example` comments and the README.

## Open questions

- Who at JG owns each account (IT? Jason?) and who pays?
- Order and downtime: a cutover window well before War Week XII prep (late Feb 2027), with a rollback per step.
- Does Paul keep admin access afterwards?

## Acceptance criteria

- [ ] Every resource above is owned by a JG account, with at least two JG admins each.
- [ ] Staging and production deploy, migrate, seed and sign in after the move; smoke-level checks pass on both.
- [ ] The maintainers guide's access table names JG owners, not Paul's personal accounts.

## Comments
