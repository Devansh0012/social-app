import type { Post, PrismaClient } from '@prisma/client';

/**
 * Personalized feed ranker — architecture inspired by the open-sourced
 * X / Twitter algorithm (xai-org/x-algorithm). We can't ship their actual
 * Heavy Ranker (it's a deep neural net trained on petabytes of Twitter
 * data + Scala/Heron real-time pipelines), but the *shape* of the
 * pipeline maps cleanly onto our data:
 *
 *   1. Candidate sources  ─ in-network (community/author affinity) + out-of-
 *      network (trending, topic-match)
 *   2. Light ranker        ─ a hand-tuned scoring function over cheap signals
 *   3. Filters             ─ deduplicate, remove deleted / admin-removed,
 *                            drop posts viewer has already engaged with too
 *                            recently
 *   4. Mixer               ─ blend sources by ratio and return top N
 *
 * Drop in an ML model later by replacing `lightScore()` — keep the signal
 * extraction (extractFeatures) stable so training data is consistent.
 */

interface ViewerSignals {
  id: string;
  interests: Set<string>;
  skills: Set<string>;
  collegeId: string;
  /** authorId -> count of recent engagement events (likes/comments/bookmarks) */
  engagedAuthors: Map<string, number>;
  /** community ids viewer is a member of */
  memberCommunityIds: Set<string>;
  /** post ids viewer has interacted with — avoid re-recommending */
  seenPostIds: Set<string>;
}

interface ScoredPost {
  post: Post;
  score: number;
  reasons: string[];
}

const CANDIDATE_POOL_SIZE = 250;
const LOOKBACK_HOURS = 72;
const ENGAGEMENT_LOOKBACK_DAYS = 30;

/** Weights for the light ranker. Tunable. */
const WEIGHTS = {
  freshness: 0.30,
  engagement: 0.25,
  authorAffinity: 0.20,
  topicAffinity: 0.15,
  communityMatch: 0.10,
};

export async function rankedFeed(
  prisma: PrismaClient,
  viewerId: string,
  first: number,
  skipPostIds: Set<string>,
): Promise<Post[]> {
  const signals = await loadViewerSignals(prisma, viewerId);
  const candidates = await fetchCandidates(prisma, signals);

  const scored: ScoredPost[] = [];
  const seen = new Set<string>(skipPostIds);
  for (const post of candidates) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    if (signals.seenPostIds.has(post.id)) continue;
    if (post.authorId === viewerId) continue; // don't show your own posts in "for you"

    const { score, reasons } = lightScore(post, signals);
    scored.push({ post, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, first).map((s) => s.post);
}

/* --------------------------------------------------------------- */
/*  Viewer signal extraction                                        */
/* --------------------------------------------------------------- */

async function loadViewerSignals(
  prisma: PrismaClient,
  viewerId: string,
): Promise<ViewerSignals> {
  const since = new Date(Date.now() - ENGAGEMENT_LOOKBACK_DAYS * 24 * 3600 * 1000);

  const [user, memberships, likes, comments, bookmarks] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewerId } }),
    prisma.communityMember.findMany({ where: { userId: viewerId } }),
    prisma.postLike.findMany({
      where: { userId: viewerId, createdAt: { gte: since } },
      include: { post: { select: { authorId: true } } },
    }),
    prisma.comment.findMany({
      where: { authorId: viewerId, createdAt: { gte: since } },
      include: { post: { select: { authorId: true } } },
    }),
    prisma.bookmark.findMany({
      where: { userId: viewerId, createdAt: { gte: since } },
      include: { post: { select: { authorId: true } } },
    }),
  ]);

  const engagedAuthors = new Map<string, number>();
  const bump = (authorId: string, weight: number) =>
    engagedAuthors.set(authorId, (engagedAuthors.get(authorId) ?? 0) + weight);

  likes.forEach((l) => l.post.authorId && bump(l.post.authorId, 1));
  bookmarks.forEach((b) => b.post.authorId && bump(b.post.authorId, 2));
  comments.forEach((c) => c.post.authorId && bump(c.post.authorId, 3));

  const seenPostIds = new Set<string>();
  likes.forEach((l) => seenPostIds.add(l.postId));
  bookmarks.forEach((b) => seenPostIds.add(b.postId));
  comments.forEach((c) => seenPostIds.add(c.postId));

  return {
    id: viewerId,
    interests: new Set((user?.interests ?? []).map((s) => s.toLowerCase())),
    skills: new Set((user?.skills ?? []).map((s) => s.toLowerCase())),
    collegeId: user?.collegeId ?? '',
    engagedAuthors,
    memberCommunityIds: new Set(memberships.map((m) => m.communityId)),
    seenPostIds,
  };
}

/* --------------------------------------------------------------- */
/*  Candidate sourcing                                              */
/* --------------------------------------------------------------- */

async function fetchCandidates(
  prisma: PrismaClient,
  signals: ViewerSignals,
): Promise<Post[]> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000);
  const base = {
    deletedAt: null,
    removedByAdmin: false,
    publishedAt: { gte: since },
  };

  // Run all source queries in parallel, then de-duplicate by id.
  const [community, authorAffinity, trending, topicMatch, collegeMates] = await Promise.all([
    // 1. In-network: posts from communities the viewer is in
    signals.memberCommunityIds.size
      ? prisma.post.findMany({
          where: { ...base, communityId: { in: [...signals.memberCommunityIds] } },
          orderBy: { publishedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([] as Post[]),

    // 2. In-network: posts by authors the viewer has engaged with
    signals.engagedAuthors.size
      ? prisma.post.findMany({
          where: { ...base, authorId: { in: [...signals.engagedAuthors.keys()] } },
          orderBy: { publishedAt: 'desc' },
          take: 60,
        })
      : Promise.resolve([] as Post[]),

    // 3. Out-of-network: trending posts (hot score is engagement velocity-ish)
    prisma.post.findMany({
      where: base,
      orderBy: [{ hotScore: 'desc' }, { publishedAt: 'desc' }],
      take: 60,
    }),

    // 4. Out-of-network: posts whose tags overlap with viewer's interests
    signals.interests.size
      ? prisma.post.findMany({
          where: { ...base, tags: { hasSome: [...signals.interests] } },
          orderBy: { publishedAt: 'desc' },
          take: 50,
        })
      : Promise.resolve([] as Post[]),

    // 5. Out-of-network: posts from same college (campus signal)
    signals.collegeId
      ? prisma.post.findMany({
          where: {
            ...base,
            author: { collegeId: signals.collegeId },
          },
          orderBy: { publishedAt: 'desc' },
          take: 40,
        })
      : Promise.resolve([] as Post[]),
  ]);

  // De-duplicate by id, preserve first occurrence (favors in-network).
  const seen = new Set<string>();
  const pool: Post[] = [];
  for (const list of [community, authorAffinity, trending, topicMatch, collegeMates]) {
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      pool.push(p);
      if (pool.length >= CANDIDATE_POOL_SIZE) return pool;
    }
  }
  return pool;
}

/* --------------------------------------------------------------- */
/*  Light ranker                                                    */
/* --------------------------------------------------------------- */

function lightScore(post: Post, signals: ViewerSignals): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // Freshness — exponential decay over LOOKBACK_HOURS
  const ageHours = (Date.now() - post.publishedAt.getTime()) / 3_600_000;
  const freshness = Math.exp(-ageHours / 24); // half-life ~16h
  if (freshness > 0.6) reasons.push('fresh');

  // Engagement velocity — normalize by age so older posts aren't unfairly boosted
  const engagementRaw =
    post.likeCount + post.commentCount * 2 + post.bookmarkCount * 1.5 + post.shareCount * 2;
  const engagement = Math.tanh(engagementRaw / Math.max(2, ageHours)) ; // 0..1
  if (engagement > 0.4) reasons.push('engagement');

  // Author affinity — log-scaled count of past interactions with this author
  const affinityRaw = signals.engagedAuthors.get(post.authorId) ?? 0;
  const authorAffinity = Math.tanh(affinityRaw / 4);
  if (authorAffinity > 0.2) reasons.push('author-affinity');

  // Topic affinity — jaccard between post tags and viewer interests
  const tagSet = new Set(post.tags.map((t) => t.toLowerCase()));
  const overlap = [...tagSet].filter((t) => signals.interests.has(t)).length;
  const denom = tagSet.size + signals.interests.size - overlap || 1;
  const topicAffinity = overlap / denom;
  if (topicAffinity > 0.1) reasons.push('topic');

  // Community match — boosted if viewer is in this community
  const communityMatch =
    post.communityId && signals.memberCommunityIds.has(post.communityId) ? 1 : 0;
  if (communityMatch) reasons.push('community');

  const score =
    WEIGHTS.freshness * freshness +
    WEIGHTS.engagement * engagement +
    WEIGHTS.authorAffinity * authorAffinity +
    WEIGHTS.topicAffinity * topicAffinity +
    WEIGHTS.communityMatch * communityMatch;

  return { score, reasons };
}
