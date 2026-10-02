UPDATE "announcement" SET "body" = jsonb_set("body", '{content}',
  coalesce("body"->'content', '[]'::jsonb) || (
    SELECT jsonb_agg(jsonb_build_object('type','video','attrs',jsonb_build_object('src', u)) ORDER BY o)
    FROM unnest("video_urls") WITH ORDINALITY AS t(u, o)))
WHERE cardinality("video_urls") > 0;
