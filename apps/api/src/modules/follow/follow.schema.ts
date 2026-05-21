export const followTypeDefs = /* GraphQL */ `
  type PublicUserConnection {
    nodes: [PublicUser!]!
    pageInfo: PageInfo!
  }

  extend type PublicUser {
    followerCount: Int!
    followingCount: Int!
    viewerIsFollowing: Boolean!
  }

  extend type Query {
    followers(username: String!, first: Int, after: String): PublicUserConnection!
    following(username: String!, first: Int, after: String): PublicUserConnection!
  }

  extend type Mutation {
    followUser(username: String!): PublicUser!
    unfollowUser(username: String!): PublicUser!
  }
`;
