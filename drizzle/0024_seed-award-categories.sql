-- The seven seeded Award Categories, keyed so seeds can name them and an
-- Organizer's rename never breaks one. They exist in every environment
-- without a seed load (a `--reset` load leaves them). Rerunning is harmless:
-- a Category already there (by key or by name, ignoring case) is skipped.
INSERT INTO "award_category" ("name", "key") VALUES
  ('War Week MVP', 'war-week-mvp'),
  ('Billable Hours Champ', 'billable-hours-champ'),
  ('Black Midnight', 'black-midnight'),
  ('Grow', 'grow'),
  ('Grind', 'grind'),
  ('Serve', 'serve'),
  ('Inspire', 'inspire')
ON CONFLICT DO NOTHING;
