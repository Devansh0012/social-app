import type { GraphqlModule } from '../types.js';
import { userTypeDefs } from './user.schema.js';
import { userResolvers } from './user.resolvers.js';

export const userModule: GraphqlModule = {
  typeDefs: userTypeDefs,
  resolvers: userResolvers,
};
