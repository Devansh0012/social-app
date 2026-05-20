import type { GraphqlModule } from '../types.js';
import { studyRoomTypeDefs } from './studyRoom.schema.js';
import { studyRoomResolvers } from './studyRoom.resolvers.js';

export const studyRoomModule: GraphqlModule = {
  typeDefs: studyRoomTypeDefs,
  resolvers: studyRoomResolvers,
};
