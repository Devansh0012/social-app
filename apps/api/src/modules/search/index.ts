import type { GraphqlModule } from '../types.js';
import { searchTypeDefs } from './search.schema.js';
import { searchResolvers } from './search.resolvers.js';

export const searchModule: GraphqlModule = {
  typeDefs: searchTypeDefs,
  resolvers: searchResolvers,
};
