import type { StudyRoom, StudyRoomMessage } from '@prisma/client';
import { userWithCollege, type GqlContext } from '../../graphql/context.js';
import { studyRoomService, type PomodoroState } from './studyRoom.service.js';
import { roomChannel, wsManager } from '../../core/ws/ws-manager.js';

interface IdArgs {
  roomId: string;
}
interface CreateArgs {
  input: Parameters<(typeof studyRoomService)['create']>[1];
}
interface MessageArgs extends IdArgs {
  body: string;
}
interface PomodoroArgs extends IdArgs {
  phase: PomodoroState['phase'];
  durationSeconds: number;
}

export const studyRoomResolvers = {
  Query: {
    async studyRoom(_p: unknown, args: { id: string }) {
      return studyRoomService.getById(args.id);
    },
    async studyRooms() {
      return studyRoomService.listActive();
    },
    async studyRoomMessages(_p: unknown, args: IdArgs) {
      const rows = await studyRoomService.listMessages(args.roomId);
      return rows.reverse();
    },
  },
  Mutation: {
    async createStudyRoom(_p: unknown, args: CreateArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return studyRoomService.create(viewer.id, args.input);
    },
    async joinStudyRoom(_p: unknown, args: IdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return studyRoomService.join(viewer.id, args.roomId);
    },
    async leaveStudyRoom(_p: unknown, args: IdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return studyRoomService.leave(viewer.id, args.roomId);
    },
    async sendStudyRoomMessage(_p: unknown, args: MessageArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return studyRoomService.postMessage(viewer.id, args.roomId, args.body);
    },
    async startPomodoro(_p: unknown, args: PomodoroArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return studyRoomService.startPomodoro(viewer.id, args.roomId, args.phase, args.durationSeconds);
    },
    async stopPomodoro(_p: unknown, args: IdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return studyRoomService.stopPomodoro(viewer.id, args.roomId);
    },
  },
  StudyRoom: {
    async creator(parent: StudyRoom, _a: unknown, ctx: GqlContext) {
      return userWithCollege(ctx.prisma, parent.creatorId);
    },
    async members(parent: StudyRoom) {
      return studyRoomService.listMembers(parent.id);
    },
    activePresence(parent: StudyRoom) {
      return wsManager.presence(roomChannel(parent.id));
    },
    pomodoro(parent: StudyRoom): PomodoroState {
      return (parent.pomodoroState as PomodoroState | null) ?? {
        phase: 'IDLE',
        startedAt: null,
        durationSeconds: 25 * 60,
        cycle: 0,
      };
    },
  },
  StudyRoomMember: {
    async user(parent: { userId: string }, _a: unknown, ctx: GqlContext) {
      return userWithCollege(ctx.prisma, parent.userId);
    },
  },
  StudyRoomMessage: {
    async author(parent: StudyRoomMessage, _a: unknown, ctx: GqlContext) {
      return userWithCollege(ctx.prisma, parent.authorId);
    },
  },
};
