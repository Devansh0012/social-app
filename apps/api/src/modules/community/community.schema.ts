export const communityTypeDefs = /* GraphQL */ `
  enum CommunityPrivacy {
    PUBLIC
    RESTRICTED
    PRIVATE
  }
  enum CommunityRoleEnum {
    MEMBER
    MODERATOR
    CREATOR
  }

  type Community {
    id: ID!
    slug: String!
    name: String!
    description: String
    iconUrl: String
    bannerUrl: String
    tags: [String!]!
    privacy: CommunityPrivacy!
    memberCount: Int!
    postCount: Int!
    createdAt: DateTime!
    viewerMembership: CommunityMembership
    creator: PublicUser
  }

  type CommunityMembership {
    role: CommunityRoleEnum!
    joinedAt: DateTime!
  }

  type CommunityConnection {
    nodes: [Community!]!
    pageInfo: PageInfo!
  }

  type PageInfo {
    endCursor: String
    hasNextPage: Boolean!
  }

  input CreateCommunityInput {
    name: String!
    description: String
    iconUrl: String
    bannerUrl: String
    tags: [String!]
    privacy: CommunityPrivacy
  }

  input UpdateCommunityInput {
    name: String
    description: String
    iconUrl: String
    bannerUrl: String
    tags: [String!]
    privacy: CommunityPrivacy
  }

  extend type Query {
    community(slug: String!): Community
    communities(search: String, first: Int, after: String): CommunityConnection!
    myCommunities: [Community!]!
  }

  extend type Mutation {
    createCommunity(input: CreateCommunityInput!): Community!
    updateCommunity(communityId: ID!, input: UpdateCommunityInput!): Community!
    joinCommunity(communityId: ID!): Community!
    leaveCommunity(communityId: ID!): Community!
  }
`;
