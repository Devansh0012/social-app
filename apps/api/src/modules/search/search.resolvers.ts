import type { GqlContext } from '../../graphql/context.js';
import { searchService } from './search.service.js';

interface SearchArgs {
  query: string;
}

export const searchResolvers = {
  Query: {
    async search(_p: unknown, args: SearchArgs, ctx: GqlContext) {
      return searchService.global(args.query, ctx.viewer?.id ?? null);
    },
  },
};
