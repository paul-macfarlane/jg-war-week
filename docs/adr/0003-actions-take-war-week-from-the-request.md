# ADR 0003: Actions take their War Week from the request, never from ambient state

- Status: accepted (built in `.scratch/hardening/issues/03`)
- Date: 2026-09-26
- Context: post-hackathon code audit; amends ADR 0001's action step order

Every server action writes to the War Week named in its request: taken from
the row it changes, or from a `warWeekId` the form posts. The server then
checks that War Week with the one access rule (ADR 0002). The
`admin_edition` cookie only decides which edition `/admin` *shows*. It never
picks a write target.

Before this, "create" actions and the settings save read the cookie at submit
time. With two tabs open, switching edition in one tab and saving in the other
wrote one edition's settings over a different edition. Reading the cookie
looks simpler, which is why this is recorded: don't reintroduce it.

Action order is fixed: authenticate, load the target War Week from the
request, check access, then parse and validate input. An action returns a
result and never throws.
