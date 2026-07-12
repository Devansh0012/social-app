export const authTypeDefs = /* GraphQL */ `
  enum UserRole {
    USER
    ADMIN
  }
  enum UserStatus {
    PENDING_VERIFICATION
    ACTIVE
    BANNED
  }

  type College {
    id: ID!
    name: String!
    domain: String!
    country: String
  }

  type AuthTokens {
    accessToken: String!
    refreshToken: String!
    accessExpiresIn: Int!
    refreshExpiresIn: Int!
  }

  type Viewer {
    id: ID!
    email: String!
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
    role: UserRole!
    status: UserStatus!
    emailVerified: Boolean!
    isVerifiedStudent: Boolean!
    onboardingCompleted: Boolean!
    reputationScore: Int!
    createdAt: DateTime!
  }

  type AuthPayload {
    viewer: Viewer!
    tokens: AuthTokens!
    """
    In dev only — the raw email-verification token, so the frontend can
    drive the verify flow without an email provider.
    """
    verifyTokenDev: String
  }

  input SignupInput {
    email: String!
    password: String!
    fullName: String!
    username: String
  }
  input LoginInput {
    email: String!
    password: String!
  }

  type RequestPasswordResetPayload {
    ok: Boolean!
    """
    In dev only — the raw reset token, so the frontend can drive the reset
    flow without an email provider.
    """
    resetTokenDev: String
  }

  extend type Query {
    me: Viewer
  }

  extend type Mutation {
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    refresh(refreshToken: String!): AuthPayload!
    verifyEmail(token: String!): Viewer!
    resendVerificationEmail: Boolean!
    requestPasswordReset(email: String!): RequestPasswordResetPayload!
    resetPassword(token: String!, newPassword: String!): Boolean!
    logout: Boolean!
  }
`;
