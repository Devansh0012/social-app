import { prisma } from '../../core/prisma.js';
import { eventBus } from '../../core/events/event-bus.js';

const TAKE = 10;

export class SearchService {
  async global(query: string, viewerId: string | null) {
    const q = query.trim();
    if (!q) return { users: [], communities: [], posts: [], materials: [] };

    eventBus.emit('search.performed', { actorId: viewerId, query: q });

    const [users, communities, posts, materials] = await Promise.all([
      prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { college: true },
        take: TAKE,
      }),
      prisma.community.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { tags: { has: q.toLowerCase() } },
          ],
        },
        orderBy: { memberCount: 'desc' },
        take: TAKE,
      }),
      prisma.post.findMany({
        where: {
          deletedAt: null,
          removedByAdmin: false,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
            { tags: { has: q.toLowerCase() } },
          ],
        },
        orderBy: [{ hotScore: 'desc' }, { publishedAt: 'desc' }],
        take: TAKE,
      }),
      prisma.studyMaterial.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { subject: { contains: q, mode: 'insensitive' } },
            { tags: { has: q.toLowerCase() } },
          ],
        },
        orderBy: { downloadCount: 'desc' },
        take: TAKE,
      }),
    ]);

    return { users, communities, posts, materials };
  }
}

export const searchService = new SearchService();
