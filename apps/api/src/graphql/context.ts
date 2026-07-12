import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@prisma/client';
import { prisma } from '../core/prisma.js';
import { AccountBanned, Unauthenticated, Forbidden, NotFound } from '../core/errors.js';
import type { AccessTokenPayload } from '../core/auth/jwt.js';

export interface ViewerContext {
  id: string;
  username: string;
  role: Role;
}

export interface GqlContext {
  app: FastifyRequest['server'];
  request: FastifyRequest;
  reply: FastifyReply;
  prisma: typeof prisma;
  viewer: ViewerContext | null;
  requireViewer: () => ViewerContext;
  requireAdmin: () => ViewerContext;
}

/**
 * Shared field-resolver helper: load a user (PublicUser/Viewer shape) together
 * with their college. Used by author/actor/uploader/member resolvers across modules.
 */
export function userWithCollege(db: typeof prisma, userId: string) {
  return db.user.findUnique({ where: { id: userId }, include: { college: true } });
}

/** Resolve a username (case-insensitive) to a user id, or throw NOT_FOUND. */
export async function userIdByUsername(db: typeof prisma, username: string): Promise<string> {
  const u = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });
  if (!u) throw NotFound('User not found');
  return u.id;
}

export async function buildContext(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<GqlContext> {
  let viewer: ViewerContext | null = null;
  let banned = false;
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await request.server.jwt.verify<AccessTokenPayload>(authHeader.slice(7));
      if (payload.type === 'access') {
        // Access tokens are stateless, so a ban must be enforced here or a
        // banned user keeps full access until the token expires. One indexed
        // PK lookup per authenticated request.
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { status: true },
        });
        if (user?.status === 'BANNED') {
          banned = true;
        } else if (user) {
          viewer = { id: payload.sub, username: payload.username, role: payload.role };
        }
      }
    } catch {
      // unauthenticated request — viewer stays null
    }
  }

  return {
    app: request.server,
    request,
    reply,
    prisma,
    viewer,
    requireViewer() {
      if (banned) throw AccountBanned();
      if (!viewer) throw Unauthenticated();
      return viewer;
    },
    requireAdmin() {
      if (banned) throw AccountBanned();
      if (!viewer) throw Unauthenticated();
      if (viewer.role !== 'ADMIN') throw Forbidden('Admin access required');
      return viewer;
    },
  };
}
