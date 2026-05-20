import type { GqlContext } from '../../graphql/context.js';
import { userService } from './user.service.js';

interface UserArgs {
  username: string;
}
interface CollegesArgs {
  search?: string | null;
}
interface UsernameArgs {
  username: string;
}
interface UpdateProfileArgs {
  input: Parameters<(typeof userService)['updateProfile']>[1];
}
interface OnboardingArgs {
  input: Parameters<(typeof userService)['completeOnboarding']>[1];
}

export const userResolvers = {
  Query: {
    async user(_p: unknown, args: UserArgs) {
      return userService.getByUsername(args.username);
    },
    async colleges(_p: unknown, args: CollegesArgs) {
      return userService.listColleges(args.search);
    },
    async isUsernameAvailable(_p: unknown, args: UsernameArgs) {
      return userService.checkUsername(args.username);
    },
  },
  Mutation: {
    async updateProfile(_p: unknown, args: UpdateProfileArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return userService.updateProfile(viewer.id, args.input);
    },
    async completeOnboarding(_p: unknown, args: OnboardingArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return userService.completeOnboarding(viewer.id, args.input);
    },
  },
};
