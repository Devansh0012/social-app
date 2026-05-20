import type { GraphqlModule } from '../types.js';
import { communityTypeDefs } from './community.schema.js';
import { communityResolvers } from './community.resolvers.js';

export const communityModule: GraphqlModule = {
  typeDefs: communityTypeDefs,
  resolvers: communityResolvers,
};
