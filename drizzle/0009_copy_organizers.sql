-- Copies the current War Week's organizer_emails into the global Organizer
-- list: distinct, trimmed, lowercased @jahnelgroup.com emails only, with
-- added_by null. "Current" matches selectCurrentWarWeek: the live one
-- (latest start_date, ties to the highest edition_number), else the earliest
-- upcoming (ties to the lowest edition_number), else the latest complete
-- (ties to the highest edition_number). No War Week inserts nothing, and an
-- email already present is skipped, so rerunning it is harmless.
INSERT INTO "organizer" ("email")
SELECT DISTINCT lower(trim(listed.email))
FROM (
  SELECT "organizer_emails"
  FROM "war_week"
  WHERE "status" IN ('live', 'upcoming', 'complete')
  ORDER BY
    CASE "status" WHEN 'live' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
    CASE WHEN "status" = 'upcoming' THEN "start_date" END ASC,
    CASE WHEN "status" = 'upcoming' THEN "edition_number" END ASC,
    CASE WHEN "status" <> 'upcoming' THEN "start_date" END DESC,
    CASE WHEN "status" <> 'upcoming' THEN "edition_number" END DESC
  LIMIT 1
) AS current_war_week
CROSS JOIN LATERAL unnest(current_war_week."organizer_emails") AS listed(email)
WHERE lower(trim(listed.email)) ~ '^[^@]+@jahnelgroup\.com$'
ON CONFLICT ("email") DO NOTHING;
