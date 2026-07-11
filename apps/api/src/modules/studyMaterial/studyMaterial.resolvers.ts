import type { StudyMaterial } from '@prisma/client';
import { userWithCollege, type GqlContext } from '../../graphql/context.js';
import type { PaginationArgs } from '../../core/pagination.js';
import { storage } from '../../core/storage/storage.js';
import { studyMaterialService } from './studyMaterial.service.js';

interface IdArgs {
  id: string;
}
interface ListArgs extends PaginationArgs {
  search?: string | null;
  collegeId?: string | null;
  department?: string | null;
  semester?: number | null;
  subject?: string | null;
}
interface CreateArgs {
  input: Parameters<(typeof studyMaterialService)['create']>[1];
}

export const studyMaterialResolvers = {
  Query: {
    async studyMaterial(_p: unknown, args: IdArgs, ctx: GqlContext) {
      const material = await studyMaterialService.getById(args.id);
      studyMaterialService.logView(material.id, ctx.viewer?.id ?? null);
      return material;
    },
    async studyMaterials(_p: unknown, args: ListArgs) {
      return studyMaterialService.list({
        search: args.search,
        collegeId: args.collegeId,
        department: args.department,
        semester: args.semester,
        subject: args.subject,
        first: args.first ?? undefined,
        after: args.after,
      });
    },
  },
  Mutation: {
    async createStudyMaterial(_p: unknown, args: CreateArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return studyMaterialService.create(viewer.id, args.input);
    },
  },
  StudyMaterial: {
    async uploader(parent: StudyMaterial, _a: unknown, ctx: GqlContext) {
      return userWithCollege(ctx.prisma, parent.uploaderId);
    },
    async college(parent: StudyMaterial, _a: unknown, ctx: GqlContext) {
      if (!parent.collegeId) return null;
      return ctx.prisma.college.findUnique({ where: { id: parent.collegeId } });
    },
    fileUrl(parent: StudyMaterial) {
      if (parent.externalUrl) return parent.externalUrl;
      if (parent.fileKey) return storage.getPublicUrl(parent.fileKey);
      return null;
    },
  },
};
