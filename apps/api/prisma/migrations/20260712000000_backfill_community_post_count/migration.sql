-- Backfill Community.postCount from live posts. Posts written outside the
-- service layer (seed, early admin moderation) bypassed the denormalized
-- counter, so recompute it from source of truth.
UPDATE "Community" c
SET "postCount" = sub.cnt
FROM (
  SELECT "communityId", COUNT(*)::int AS cnt
  FROM "Post"
  WHERE "communityId" IS NOT NULL AND "deletedAt" IS NULL
  GROUP BY "communityId"
) sub
WHERE c."id" = sub."communityId";

UPDATE "Community"
SET "postCount" = 0
WHERE "id" NOT IN (
  SELECT DISTINCT "communityId" FROM "Post"
  WHERE "communityId" IS NOT NULL AND "deletedAt" IS NULL
);
