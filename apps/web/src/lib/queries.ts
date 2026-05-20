export const VIEWER_FRAGMENT = /* GraphQL */ `
  fragment ViewerFields on Viewer {
    id
    email
    username
    fullName
    avatarUrl
    bio
    college {
      id
      name
      domain
    }
    department
    graduationYear
    interests
    skills
    socialLinks
    role
    status
    emailVerified
    isVerifiedStudent
    onboardingCompleted
    reputationScore
    createdAt
  }
`;

export const PUBLIC_USER_FRAGMENT = /* GraphQL */ `
  fragment PublicUserFields on PublicUser {
    id
    username
    fullName
    avatarUrl
    bio
    college {
      id
      name
      domain
    }
    department
    graduationYear
    interests
    skills
    isVerifiedStudent
    reputationScore
    createdAt
  }
`;

export const POST_FRAGMENT = /* GraphQL */ `
  fragment PostFields on Post {
    id
    type
    title
    body
    linkUrl
    imageUrls
    tags
    likeCount
    commentCount
    bookmarkCount
    shareCount
    viewCount
    hotScore
    publishedAt
    viewerHasLiked
    viewerHasBookmarked
    author {
      ...PublicUserFields
    }
    community {
      id
      slug
      name
      iconUrl
    }
    collab {
      projectTitle
      requiredSkills
      projectType
      duration
      teamSize
      locationType
      openSlots
      isClosed
    }
  }
  ${PUBLIC_USER_FRAGMENT}
`;

export const SIGNUP_MUTATION = /* GraphQL */ `
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      viewer { ...ViewerFields }
      tokens { accessToken refreshToken accessExpiresIn refreshExpiresIn }
      verifyTokenDev
    }
  }
  ${VIEWER_FRAGMENT}
`;

export const LOGIN_MUTATION = /* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      viewer { ...ViewerFields }
      tokens { accessToken refreshToken accessExpiresIn refreshExpiresIn }
    }
  }
  ${VIEWER_FRAGMENT}
`;

export const ME_QUERY = /* GraphQL */ `
  query Me {
    me { ...ViewerFields }
  }
  ${VIEWER_FRAGMENT}
`;

export const COLLEGES_QUERY = /* GraphQL */ `
  query Colleges($search: String) {
    colleges(search: $search) {
      id
      name
      domain
      country
    }
  }
`;

export const USERNAME_CHECK_QUERY = /* GraphQL */ `
  query UsernameCheck($username: String!) {
    isUsernameAvailable(username: $username) {
      available
    }
  }
`;

export const COMPLETE_ONBOARDING_MUTATION = /* GraphQL */ `
  mutation CompleteOnboarding($input: CompleteOnboardingInput!) {
    completeOnboarding(input: $input) {
      ...ViewerFields
    }
  }
  ${VIEWER_FRAGMENT}
`;

export const VERIFY_EMAIL_MUTATION = /* GraphQL */ `
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token) { ...ViewerFields }
  }
  ${VIEWER_FRAGMENT}
`;

export const FEED_QUERY = /* GraphQL */ `
  query Feed($kind: FeedKind!, $communityId: ID, $after: String) {
    feed(kind: $kind, communityId: $communityId, first: 20, after: $after) {
      nodes { ...PostFields }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${POST_FRAGMENT}
`;

export const COMMUNITIES_QUERY = /* GraphQL */ `
  query Communities($search: String, $after: String) {
    communities(search: $search, first: 25, after: $after) {
      nodes {
        id
        slug
        name
        description
        iconUrl
        bannerUrl
        tags
        privacy
        memberCount
        postCount
        createdAt
        viewerMembership { role joinedAt }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const COMMUNITY_QUERY = /* GraphQL */ `
  query Community($slug: String!) {
    community(slug: $slug) {
      id
      slug
      name
      description
      iconUrl
      bannerUrl
      tags
      privacy
      memberCount
      postCount
      createdAt
      viewerMembership { role joinedAt }
      creator { ...PublicUserFields }
    }
  }
  ${PUBLIC_USER_FRAGMENT}
`;

export const MY_COMMUNITIES_QUERY = /* GraphQL */ `
  query MyCommunities {
    myCommunities {
      id
      slug
      name
      iconUrl
      memberCount
    }
  }
`;

export const JOIN_COMMUNITY_MUTATION = /* GraphQL */ `
  mutation JoinCommunity($communityId: ID!) {
    joinCommunity(communityId: $communityId) { id memberCount viewerMembership { role joinedAt } }
  }
`;
export const LEAVE_COMMUNITY_MUTATION = /* GraphQL */ `
  mutation LeaveCommunity($communityId: ID!) {
    leaveCommunity(communityId: $communityId) { id memberCount viewerMembership { role joinedAt } }
  }
`;
export const CREATE_COMMUNITY_MUTATION = /* GraphQL */ `
  mutation CreateCommunity($input: CreateCommunityInput!) {
    createCommunity(input: $input) {
      id
      slug
      name
      description
      memberCount
    }
  }
`;

export const CREATE_POST_MUTATION = /* GraphQL */ `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) { ...PostFields }
  }
  ${POST_FRAGMENT}
`;

export const LIKE_POST_MUTATION = /* GraphQL */ `
  mutation LikePost($postId: ID!) {
    likePost(postId: $postId) { id likeCount viewerHasLiked }
  }
`;
export const UNLIKE_POST_MUTATION = /* GraphQL */ `
  mutation UnlikePost($postId: ID!) {
    unlikePost(postId: $postId) { id likeCount viewerHasLiked }
  }
`;
export const BOOKMARK_POST_MUTATION = /* GraphQL */ `
  mutation BookmarkPost($postId: ID!) {
    bookmarkPost(postId: $postId) { id bookmarkCount viewerHasBookmarked }
  }
`;
export const UNBOOKMARK_POST_MUTATION = /* GraphQL */ `
  mutation UnbookmarkPost($postId: ID!) {
    unbookmarkPost(postId: $postId) { id bookmarkCount viewerHasBookmarked }
  }
`;

export const USER_PROFILE_QUERY = /* GraphQL */ `
  query UserProfile($username: String!) {
    user(username: $username) { ...PublicUserFields }
  }
  ${PUBLIC_USER_FRAGMENT}
`;

export const NOTIFICATIONS_QUERY = /* GraphQL */ `
  query Notifications($unreadOnly: Boolean) {
    notifications(unreadOnly: $unreadOnly, limit: 50) {
      id
      type
      payload
      readAt
      createdAt
      actor { ...PublicUserFields }
    }
    unreadNotificationCount
  }
  ${PUBLIC_USER_FRAGMENT}
`;

export const MARK_NOTIFICATION_READ_MUTATION = /* GraphQL */ `
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) { id readAt }
  }
`;

export const STUDY_ROOMS_QUERY = /* GraphQL */ `
  query StudyRooms {
    studyRooms {
      id
      name
      description
      topic
      maxParticipants
      isActive
      createdAt
      activePresence
      pomodoro { phase startedAt durationSeconds cycle }
      creator { ...PublicUserFields }
    }
  }
  ${PUBLIC_USER_FRAGMENT}
`;

export const CREATE_STUDY_ROOM_MUTATION = /* GraphQL */ `
  mutation CreateStudyRoom($input: CreateStudyRoomInput!) {
    createStudyRoom(input: $input) { id name }
  }
`;
