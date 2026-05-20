export const userTypeDefs = /* GraphQL */ `
  type PublicUser {
    id: ID!
    username: String!
    fullName: String!
    bio: String
    avatarUrl: String
    college: College!
    department: String
    graduationYear: Int
    interests: [String!]!
    skills: [String!]!
    socialLinks: JSON
    isVerifiedStudent: Boolean!
    reputationScore: Int!
    createdAt: DateTime!
  }

  type UsernameCheck {
    available: Boolean!
  }

  input UpdateProfileInput {
    fullName: String
    username: String
    bio: String
    avatarUrl: String
    department: String
    graduationYear: Int
    interests: [String!]
    skills: [String!]
    socialLinks: JSON
  }

  input CompleteOnboardingInput {
    username: String!
    department: String!
    graduationYear: Int!
    interests: [String!]!
    skills: [String!]
    bio: String
  }

  extend type Query {
    user(username: String!): PublicUser
    colleges(search: String): [College!]!
    isUsernameAvailable(username: String!): UsernameCheck!
  }

  extend type Mutation {
    updateProfile(input: UpdateProfileInput!): Viewer!
    completeOnboarding(input: CompleteOnboardingInput!): Viewer!
  }
`;
