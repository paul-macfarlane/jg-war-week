# 02: The sync contract between Stairs and JG War Week

**Type:** grilling

**Status:** open

**Blocked by:** 01

## Question

How does JG War Week continuously mirror Stairs, with a manual refresh? Decide: pull vs push (a feed endpoint polled on a schedule, or a webhook from Stairs on each entry); the endpoint shape (entries or totals since a cursor, for a date window); server-to-server auth (API key or similar, since `/v1` needs a signed-in person's Firebase token); what refresh does (incremental vs full re-pull of a window); and behaviour when Stairs is down or data is corrected after the fact. Agreed with the Stairs owner: nothing too crazy.

## Comments
