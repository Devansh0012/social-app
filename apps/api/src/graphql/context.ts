import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@prisma/client';
import { prisma } from '../core/prisma.js';
import { Unauthenticated, Forbidden } from '../core/errors.js';
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

export async function buildContext(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<GqlContext> {
  let viewer: ViewerContext | null = null;
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await request.server.jwt.verify<AccessTokenPayload>(authHeader.slice(7));
      if (payload.type === 'access') {
        viewer = { id: payload.sub, username: payload.username, role: payload.role };
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
      if (!viewer) throw Unauthenticated();
      return viewer;
    },
    requireAdmin() {
      if (!viewer) throw Unauthenticated();
      if (viewer.role !== 'ADMIN') throw Forbidden('Admin access required');
      return viewer;
    },
  };
}
