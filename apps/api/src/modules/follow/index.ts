import type { GraphqlModule } from '../types.js';
import { followTypeDefs } from './follow.schema.js';
import { followResolvers } from './follow.resolvers.js';

export const followModule: GraphqlModule = {
  typeDefs: followTypeDefs,
  resolvers: followResolvers,
};
