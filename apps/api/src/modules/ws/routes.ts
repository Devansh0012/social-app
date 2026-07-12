import type { FastifyInstance } from 'fastify';
import type { AccessTokenPayload } from '../../core/auth/jwt.js';
import { roomChannel, userChannel, wsManager } from '../../core/ws/ws-manager.js';
import { prisma } from '../../core/prisma.js';

/**
 *   ws://host/ws/notifications?token=<accessToken>
 *   ws://host/ws/rooms/:roomId?token=<accessToken>
 *
 * The access token is passed via query string because browsers cannot set
 * Authorization headers on WebSocket connections. Server-side we verify it
 * the same way as the GraphQL bearer.
 */
export async function registerWsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws/notifications', { websocket: true }, async (socket, req) => {
    const viewer = await verifyWsToken(app, req);
    if (!viewer) {
      socket.close(4001, 'unauthorized');
      return;
    }
    const channel = userChannel(viewer.sub);
    wsManager.join(channel, socket);
    socket.send(JSON.stringify({ type: 'HELLO', data: { channel }, ts: Date.now() }));
  });

  app.get<{ Params: { roomId: string } }>(
    '/ws/rooms/:roomId',
    { websocket: true },
    async (socket, req) => {
      const viewer = await verifyWsToken(app, req);
      if (!viewer) {
        socket.close(4001, 'unauthorized');
        return;
      }
      const { roomId } = req.params;
      const room = await prisma.studyRoom.findUnique({ where: { id: roomId } });
      if (!room || !room.isActive) {
        socket.close(4004, 'room not found');
        return;
      }
      const member = await prisma.studyRoomMember.findUnique({
        where: { roomId_userId: { roomId, userId: viewer.sub } },
      });
      if (!member || member.leftAt) {
        socket.close(4003, 'not a room member');
        return;
      }

      const channel = roomChannel(roomId);
      wsManager.join(channel, socket);

      wsManager.publish(channel, {
        type: 'PRESENCE_JOINED',
        data: { userId: viewer.sub, count: wsManager.presence(channel) },
      });

      socket.on('close', () => {
        wsManager.publish(channel, {
          type: 'PRESENCE_LEFT',
          data: { userId: viewer.sub, count: wsManager.presence(channel) },
        });
      });
    },
  );
}

async function verifyWsToken(
  app: FastifyInstance,
  req: import('fastify').FastifyRequest,
): Promise<AccessTokenPayload | null> {
  const query = req.query as { token?: string };
  if (!query.token) return null;
  try {
    const decoded = await app.jwt.verify<AccessTokenPayload>(query.token);
    if (decoded.type !== 'access') return null;
    // Enforce bans on socket connects too — access tokens are stateless.
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { status: true },
    });
    if (!user || user.status === 'BANNED') return null;
    return decoded;
  } catch {
    return null;
  }
}
