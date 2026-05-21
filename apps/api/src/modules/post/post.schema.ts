export const postTypeDefs = /* GraphQL */ `
  enum PostType {
    TEXT
    IMAGE
    MARKDOWN
    LINK
    COLLAB
  }

  enum FeedKind {
    GLOBAL
    TRENDING
    FOLLOWING
    PERSONALIZED
    COMMUNITY
  }

  enum CollabProjectType {
    HACKATHON
    PROJECT
    RESEARCH
    STARTUP
  }
  enum CollabDuration {
    SHORT
    MEDIUM
    LONG
    ONGOING
  }
  enum CollabLocation {
    REMOTE
    IN_PERSON
    HYBRID
  }
  enum CollabApplicationStatus {
    PENDING
    ACCEPTED
    REJECTED
    WITHDRAWN
  }

  type Post {
    id: ID!
    type: PostType!
    title: String
    body: String
    linkUrl: String
    imageUrls: [String!]!
    tags: [String!]!
    likeCount: Int!
    commentCount: Int!
    bookmarkCount: Int!
    shareCount: Int!
    viewCount: Int!
    hotScore: Float!
    publishedAt: DateTime!
    updatedAt: DateTime!
    author: PublicUser!
    community: Community
    collab: CollabDetails
    viewerHasLiked: Boolean!
    viewerHasBookmarked: Boolean!
  }

  type CollabDetails {
    projectTitle: String!
    requiredSkills: [String!]!
    projectType: CollabProjectType!
    duration: CollabDuration!
    teamSize: Int!
    locationType: CollabLocation!
    openSlots: Int!
    isClosed: Boolean!
  }

  type PostConnection {
    nodes: [Post!]!
    pageInfo: PageInfo!
  }

  type Comment {
    id: ID!
    postId: ID!
    parentId: ID
    body: String!
    createdAt: DateTime!
    author: PublicUser!
  }

  type CollabApplication {
    id: ID!
    message: String!
    status: CollabApplicationStatus!
    createdAt: DateTime!
    applicant: PublicUser!
    post: Post
  }

  input CollabPostInput {
    projectTitle: String!
    requiredSkills: [String!]!
    projectType: CollabProjectType!
    duration: CollabDuration!
    teamSize: Int!
    locationType: CollabLocation!
    openSlots: Int!
  }

  input CreatePostInput {
    type: PostType!
    communityId: ID
    title: String
    body: String
    linkUrl: String
    imageUrls: [String!]
    tags: [String!]
    collab: CollabPostInput
  }

  input CreateCommentInput {
    postId: ID!
    parentId: ID
    body: String!
  }

  input ApplyCollabInput {
    postId: ID!
    message: String!
  }

  input UpdatePostInput {
    title: String
    body: String
    linkUrl: String
    tags: [String!]
  }

  extend type Query {
    post(id: ID!): Post
    feed(kind: FeedKind!, communityId: ID, first: Int, after: String): PostConnection!
    postComments(postId: ID!): [Comment!]!
    myCollabApplications: [CollabApplication!]!
    collabApplicationsForPost(postId: ID!): [CollabApplication!]!
    userPosts(username: String!, first: Int, after: String): PostConnection!
    userComments(username: String!, first: Int, after: String): [Comment!]!
    myLikedPosts(first: Int, after: String): PostConnection!
    myBookmarkedPosts(first: Int, after: String): PostConnection!
  }

  extend type Mutation {
    createPost(input: CreatePostInput!): Post!
    updatePost(postId: ID!, input: UpdatePostInput!): Post!
    deletePost(postId: ID!): Boolean!
    likePost(postId: ID!): Post!
    unlikePost(postId: ID!): Post!
    bookmarkPost(postId: ID!): Post!
    unbookmarkPost(postId: ID!): Post!
    sharePost(postId: ID!): Post!
    addComment(input: CreateCommentInput!): Comment!
    updateComment(commentId: ID!, body: String!): Comment!
    deleteComment(commentId: ID!): Boolean!
    applyToCollab(input: ApplyCollabInput!): CollabApplication!
    respondToCollabApplication(
      applicationId: ID!
      decision: CollabApplicationStatus!
    ): CollabApplication!
  }
`;
