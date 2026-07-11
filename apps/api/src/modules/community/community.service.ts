import slugify from 'slugify';
import { z } from 'zod';
import type { CommunityPrivacy } from '@prisma/client';
import { prisma } from '../../core/prisma.js';
import { Conflict, Forbidden, NotFound, parseOrThrow } from '../../core/errors.js';
import { eventBus } from '../../core/events/event-bus.js';
import { buildConnection, decodeCursor, PaginationInput } from '../../core/pagination.js';

const CreateCommunitySchema = z.object({
  name: z.string().trim().min(3).max(50),
  description: z.string().max(280).optional(),
  iconUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  privacy: z.enum(['PUBLIC', 'RESTRICTED', 'PRIVATE']).default('PUBLIC'),
});

const UpdateCommunitySchema = CreateCommunitySchema.partial();

export class CommunityService {
  async create(creatorId: string, rawInput: unknown) {
    const input = parseOrThrow(CreateCommunitySchema, rawInput, 'Invalid community input');

    const slug = await this.ensureUniqueSlug(input.name);

    return prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          slug,
          name: input.name,
          description: input.description,
          iconUrl: input.iconUrl,
          bannerUrl: input.bannerUrl,
          tags: input.tags ?? [],
          privacy: input.privacy as CommunityPrivacy,
          creatorId,
          memberCount: 1,
        },
      });
      await tx.communityMember.create({
        data: { communityId: community.id, userId: creatorId, role: 'CREATOR' },
      });
      return community;
    });
  }

  async update(viewerId: string, communityId: string, rawInput: unknown) {
    const input = parseOrThrow(UpdateCommunitySchema, rawInput, 'Invalid input');

    await this.assertCanModerate(viewerId, communityId);
    return prisma.community.update({
      where: { id: communityId },
      data: {
        name: input.name,
        description: input.description,
        iconUrl: input.iconUrl,
        bannerUrl: input.bannerUrl,
        tags: input.tags,
        privacy: input.privacy as CommunityPrivacy | undefined,
      },
    });
  }

  async getBySlug(slug: string) {
    const c = await prisma.community.findUnique({ where: { slug: slug.toLowerCase() } });
    if (!c || c.deletedAt) return null;
    return c;
  }

  async list(args: { search?: string | null; first?: number; after?: string | null }) {
    const pag = PaginationInput.parse({ first: args.first ?? 20, after: args.after ?? null });
    const cursor = decodeCursor(pag.after);

    const rows = await prisma.community.findMany({
      where: {
        deletedAt: null,
        ...(args.search
          ? {
              OR: [
                { name: { contains: args.search, mode: 'insensitive' } },
                { description: { contains: args.search, mode: 'insensitive' } },
                { tags: { has: args.search.toLowerCase() } },
              ],
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { memberCount: { lt: Number(cursor.at) } },
                { memberCount: Number(cursor.at), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ memberCount: 'desc' }, { id: 'desc' }],
      take: pag.first + 1,
    });

    return buildConnection(rows, pag.first, (c) => ({ at: String(c.memberCount), id: c.id }));
  }

  async listMine(userId: string) {
    return prisma.community.findMany({
      where: { deletedAt: null, members: { some: { userId } } },
      orderBy: { name: 'asc' },
    });
  }

  async join(viewerId: string, communityId: string) {
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community || community.deletedAt) throw NotFound('Community not found');
    if (community.privacy === 'PRIVATE') throw Forbidden('This community is invite-only.');

    const existing = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: viewerId, communityId } },
    });
    if (existing) return community;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.communityMember.create({
        data: { userId: viewerId, communityId, role: 'MEMBER' },
      });
      return tx.community.update({
        where: { id: communityId },
        data: { memberCount: { increment: 1 } },
      });
    });

    eventBus.emit('community.joined', { communityId, actorId: viewerId });
    return updated;
  }

  async leave(viewerId: string, communityId: string) {
    const member = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: viewerId, communityId } },
    });
    if (!member) throw NotFound('You are not a member of this community.');
    if (member.role === 'CREATOR')
      throw Forbidden('Creators must transfer ownership before leaving.');

    const updated = await prisma.$transaction(async (tx) => {
      await tx.communityMember.delete({
        where: { userId_communityId: { userId: viewerId, communityId } },
      });
      return tx.community.update({
        where: { id: communityId },
        data: { memberCount: { decrement: 1 } },
      });
    });

    eventBus.emit('community.left', { communityId, actorId: viewerId });
    return updated;
  }

  async viewerMembership(viewerId: string | null, communityId: string) {
    if (!viewerId) return null;
    return prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: viewerId, communityId } },
    });
  }

  private async assertCanModerate(viewerId: string, communityId: string) {
    const member = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: viewerId, communityId } },
    });
    if (!member || (member.role !== 'CREATOR' && member.role !== 'MODERATOR')) {
      throw Forbidden('Only moderators or the creator can modify this community.');
    }
  }

  private async ensureUniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true }).slice(0, 40) || 'community';
    let candidate = base;
    for (let i = 0; i < 10; i++) {
      const exists = await prisma.community.findUnique({ where: { slug: candidate } });
      if (!exists) return candidate;
      candidate = `${base}-${Math.floor(Math.random() * 9999)}`;
    }
    throw Conflict('Could not generate a unique slug.');
  }
}

export const communityService = new CommunityService();
