import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../core/prisma.js';
import { NotFound, Validation } from '../../core/errors.js';
import { eventBus } from '../../core/events/event-bus.js';
import {
  buildConnection,
  decodeCursor,
  PaginationInput,
} from '../../core/pagination.js';

const CreateMaterialSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().max(2000).optional(),
  collegeId: z.string().cuid().optional(),
  department: z.string().max(80).optional(),
  semester: z.number().int().min(1).max(12).optional(),
  subject: z.string().max(80).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  fileKey: z.string().optional(),
  fileMime: z.string().optional(),
  fileSize: z.number().int().nonnegative().optional(),
  externalUrl: z.string().url().optional(),
});

export class StudyMaterialService {
  async create(uploaderId: string, rawInput: unknown) {
    const parsed = CreateMaterialSchema.safeParse(rawInput);
    if (!parsed.success) throw Validation('Invalid input', parsed.error.flatten());

    if (!parsed.data.fileKey && !parsed.data.externalUrl) {
      throw Validation('A file upload or external URL is required');
    }

    return prisma.studyMaterial.create({
      data: {
        uploaderId,
        title: parsed.data.title,
        description: parsed.data.description,
        collegeId: parsed.data.collegeId,
        department: parsed.data.department,
        semester: parsed.data.semester,
        subject: parsed.data.subject,
        tags: parsed.data.tags ?? [],
        fileKey: parsed.data.fileKey,
        fileMime: parsed.data.fileMime,
        fileSize: parsed.data.fileSize,
        externalUrl: parsed.data.externalUrl,
      },
    });
  }

  async list(args: {
    search?: string | null;
    collegeId?: string | null;
    department?: string | null;
    semester?: number | null;
    subject?: string | null;
    first?: number;
    after?: string | null;
  }) {
    const pag = PaginationInput.parse({ first: args.first ?? 20, after: args.after ?? null });
    const cursor = decodeCursor(pag.after);

    const where: Prisma.StudyMaterialWhereInput = {
      deletedAt: null,
      ...(args.collegeId ? { collegeId: args.collegeId } : {}),
      ...(args.department ? { department: args.department } : {}),
      ...(args.semester ? { semester: args.semester } : {}),
      ...(args.subject ? { subject: { equals: args.subject, mode: 'insensitive' } } : {}),
      ...(args.search
        ? {
            OR: [
              { title: { contains: args.search, mode: 'insensitive' } },
              { description: { contains: args.search, mode: 'insensitive' } },
              { tags: { has: args.search.toLowerCase() } },
            ],
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.at) } },
              { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
            ],
          }
        : {}),
    };

    const rows = await prisma.studyMaterial.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pag.first + 1,
    });
    return buildConnection(rows, pag.first, (r) => ({ at: r.createdAt.toISOString(), id: r.id }));
  }

  async getById(id: string) {
    const m = await prisma.studyMaterial.findUnique({ where: { id } });
    if (!m || m.deletedAt) throw NotFound('Study material not found');
    return m;
  }

  /**
   * Called by the REST download route — records the download + emits event.
   */
  async recordDownload(materialId: string, userId: string) {
    await prisma.$transaction([
      prisma.studyMaterialDownload.create({ data: { materialId, userId } }),
      prisma.studyMaterial.update({
        where: { id: materialId },
        data: { downloadCount: { increment: 1 } },
      }),
    ]);
    eventBus.emit('study-material.downloaded', { materialId, actorId: userId });
  }

  async logView(materialId: string, actorId: string | null) {
    eventBus.emit('study-material.viewed', { materialId, actorId });
  }
}

export const studyMaterialService = new StudyMaterialService();
