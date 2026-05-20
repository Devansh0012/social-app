import type { FastifyInstance } from 'fastify';
import { storage } from '../../core/storage/storage.js';
import { studyMaterialService } from './studyMaterial.service.js';
import { BadRequest, NotFound, Unauthenticated } from '../../core/errors.js';
import type { AccessTokenPayload } from '../../core/auth/jwt.js';

/**
 * REST routes for binary uploads / downloads — kept outside GraphQL because
 * multipart streaming through GraphQL adds friction with little benefit.
 *
 *   POST /uploads/study-material   → upload a file, returns { key, url, mime, size }
 *   POST /study-materials/:id/download → records the download + returns the public URL
 */
export async function registerStudyMaterialRoutes(app: FastifyInstance): Promise<void> {
  app.post('/uploads/study-material', async (req, reply) => {
    const viewer = await authenticate(req);

    const file = await req.file();
    if (!file) throw BadRequest('No file uploaded');

    const buffer = await file.toBuffer();
    const uploaded = await storage.put({
      buffer,
      mimeType: file.mimetype,
      originalName: file.filename,
      prefix: `study-materials/${viewer.sub}`,
    });
    reply.send(uploaded);
  });

  app.post('/study-materials/:id/download', async (req, reply) => {
    const viewer = await authenticate(req);
    const params = req.params as { id?: string };
    if (!params.id) throw BadRequest('Missing id');
    const material = await studyMaterialService.getById(params.id);
    if (!material.fileKey && !material.externalUrl) throw NotFound('Material has no file');
    await studyMaterialService.recordDownload(material.id, viewer.sub);
    const url =
      material.externalUrl ?? (await storage.getPublicUrl(material.fileKey ?? ''));
    reply.send({ url });
  });
}

async function authenticate(req: import('fastify').FastifyRequest) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) throw Unauthenticated();
  try {
    const decoded = await req.server.jwt.verify<AccessTokenPayload>(auth.slice(7));
    if (decoded.type !== 'access') throw Unauthenticated();
    return decoded;
  } catch {
    throw Unauthenticated();
  }
}
