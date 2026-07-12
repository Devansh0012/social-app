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

/** Shape of every `pageInfo { hasNextPage endCursor }` selection below. */
export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/**
 * TS mirror of PUBLIC_USER_FRAGMENT — the shape every `...PublicUserFields`
 * selection (post/comment authors, notification actors, search results,
 * profiles) returns at runtime. Keep in sync with the fragment below.
 */
export interface PublicUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  college: { id: string; name: string; domain: string } | null;
  department: string | null;
  graduationYear: number | null;
  interests: string[];
  skills: string[];
  isVerifiedStudent: boolean;
  reputationScore: number;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  viewerIsFollowing: boolean;
}

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
    followerCount
    followingCount
    viewerIsFollowing
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

export const REQUEST_PASSWORD_RESET_MUTATION = /* GraphQL */ `
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email) {
      ok
      resetTokenDev
    }
  }
`;

export const RESET_PASSWORD_MUTATION = /* GraphQL */ `
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
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
export const SHARE_POST_MUTATION = /* GraphQL */ `
  mutation SharePost($postId: ID!) {
    sharePost(postId: $postId) { id shareCount }
  }
`;

/**
 * Common shape of a comment row as returned by postComments / userComments /
 * addComment / updateComment. `parentId` is only fetched by POST_DETAIL_QUERY,
 * so it lives on the page-local extension, not here.
 */
export interface CommentRow {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  author: PublicUser;
}

export const POST_DETAIL_QUERY = /* GraphQL */ `
  query PostDetail($id: ID!) {
    post(id: $id) { ...PostFields }
    postComments(postId: $id) {
      id
      postId
      parentId
      body
      createdAt
      author { ...PublicUserFields }
    }
  }
  ${POST_FRAGMENT}
`;

export const ADD_COMMENT_MUTATION = /* GraphQL */ `
  mutation AddComment($input: CreateCommentInput!) {
    addComment(input: $input) {
      id
      postId
      parentId
      body
      createdAt
      author { ...PublicUserFields }
    }
  }
  ${PUBLIC_USER_FRAGMENT}
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

export const MARK_ALL_NOTIFICATIONS_READ_MUTATION = /* GraphQL */ `
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
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

/* ---------------------------------- admin ---------------------------------- */

export const ADMIN_USER_FRAGMENT = /* GraphQL */ `
  fragment AdminUserFields on AdminUserView {
    id
    email
    username
    fullName
    avatarUrl
    college { id name domain country }
    department
    graduationYear
    role
    status
    emailVerified
    isVerifiedStudent
    onboardingCompleted
    reputationScore
    createdAt
  }
`;

export const ADMIN_USERS_QUERY = /* GraphQL */ `
  query AdminUsers($status: UserStatus, $search: String, $after: String) {
    adminUsers(status: $status, search: $search, first: 30, after: $after) {
      nodes { ...AdminUserFields }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
  ${ADMIN_USER_FRAGMENT}
`;

export const ADMIN_VERIFY_USER_MUTATION = /* GraphQL */ `
  mutation AdminVerifyUser($userId: ID!) {
    adminVerifyUser(userId: $userId) { ...AdminUserFields }
  }
  ${ADMIN_USER_FRAGMENT}
`;

export const ADMIN_SET_USER_ROLE_MUTATION = /* GraphQL */ `
  mutation AdminSetRole($userId: ID!, $role: UserRole!) {
    adminSetUserRole(userId: $userId, role: $role) { ...AdminUserFields }
  }
  ${ADMIN_USER_FRAGMENT}
`;

export const ADMIN_BAN_USER_MUTATION = /* GraphQL */ `
  mutation AdminBan($userId: ID!, $reason: String!) {
    banUser(userId: $userId, reason: $reason) { ...AdminUserFields }
  }
  ${ADMIN_USER_FRAGMENT}
`;

export const ADMIN_UNBAN_USER_MUTATION = /* GraphQL */ `
  mutation AdminUnban($userId: ID!) {
    unbanUser(userId: $userId) { ...AdminUserFields }
  }
  ${ADMIN_USER_FRAGMENT}
`;

export const ADMIN_CREATE_USER_MUTATION = /* GraphQL */ `
  mutation AdminCreateUser($input: AdminCreateUserInput!) {
    adminCreateUser(input: $input) { ...AdminUserFields }
  }
  ${ADMIN_USER_FRAGMENT}
`;

/** TS mirror of the adminColleges selection below. */
export interface AdminCollege {
  id: string;
  name: string;
  domain: string;
  country: string | null;
  createdAt: string;
  userCount: number;
}

export const ADMIN_COLLEGES_QUERY = /* GraphQL */ `
  query AdminColleges($search: String) {
    adminColleges(search: $search) {
      id
      name
      domain
      country
      createdAt
      userCount
    }
  }
`;

export const ADMIN_CREATE_COLLEGE_MUTATION = /* GraphQL */ `
  mutation AdminCreateCollege($input: AdminCreateCollegeInput!) {
    adminCreateCollege(input: $input) { id name domain country }
  }
`;

export const ADMIN_UPDATE_COLLEGE_MUTATION = /* GraphQL */ `
  mutation AdminUpdateCollege($id: ID!, $input: AdminUpdateCollegeInput!) {
    adminUpdateCollege(id: $id, input: $input) { id name domain country }
  }
`;

export const ADMIN_DELETE_COLLEGE_MUTATION = /* GraphQL */ `
  mutation AdminDeleteCollege($id: ID!) {
    adminDeleteCollege(id: $id)
  }
`;

/* ----------------------------------- follow ----------------------------------- */

export const FOLLOW_USER_MUTATION = /* GraphQL */ `
  mutation FollowUser($username: String!) {
    followUser(username: $username) { ...PublicUserFields }
  }
  ${PUBLIC_USER_FRAGMENT}
`;
export const UNFOLLOW_USER_MUTATION = /* GraphQL */ `
  mutation UnfollowUser($username: String!) {
    unfollowUser(username: $username) { ...PublicUserFields }
  }
  ${PUBLIC_USER_FRAGMENT}
`;

/* ------------------------------------ DMs ------------------------------------- */

/** TS mirror of DM_AUTHOR_FRAGMENT — the compact user shape used in DMs. */
export interface DMAuthor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  isVerifiedStudent: boolean;
  college: { id: string; name: string } | null;
}

export const DM_AUTHOR_FRAGMENT = /* GraphQL */ `
  fragment DMAuthor on PublicUser {
    id
    username
    fullName
    avatarUrl
    isVerifiedStudent
    college { id name }
  }
`;

export const CONVERSATIONS_QUERY = /* GraphQL */ `
  query Conversations {
    conversations {
      id
      lastMessageAt
      unreadCount
      otherParticipants { ...DMAuthor }
      lastMessage {
        id
        body
        createdAt
        author { id username fullName }
      }
    }
    unreadDMCount
  }
  ${DM_AUTHOR_FRAGMENT}
`;

export const CONVERSATION_QUERY = /* GraphQL */ `
  query Conversation($id: ID!) {
    conversation(id: $id) {
      id
      lastMessageAt
      otherParticipants { ...DMAuthor }
      unreadCount
    }
  }
  ${DM_AUTHOR_FRAGMENT}
`;

export const MESSAGES_QUERY = /* GraphQL */ `
  query Messages($conversationId: ID!, $after: String) {
    messages(conversationId: $conversationId, after: $after, first: 50) {
      nodes {
        id
        conversationId
        body
        createdAt
        author { ...DMAuthor }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${DM_AUTHOR_FRAGMENT}
`;

export const OPEN_CONVERSATION_MUTATION = /* GraphQL */ `
  mutation OpenConversation($username: String!) {
    openConversation(username: $username) {
      id
      otherParticipants { ...DMAuthor }
    }
  }
  ${DM_AUTHOR_FRAGMENT}
`;

export const SEND_DM_MUTATION = /* GraphQL */ `
  mutation SendDM($conversationId: ID!, $body: String!) {
    sendMessage(conversationId: $conversationId, body: $body) {
      id
      conversationId
      body
      createdAt
      author { ...DMAuthor }
    }
  }
  ${DM_AUTHOR_FRAGMENT}
`;

export const MARK_CONVERSATION_READ_MUTATION = /* GraphQL */ `
  mutation MarkConversationRead($conversationId: ID!) {
    markConversationRead(conversationId: $conversationId)
  }
`;

/* ------------------------------- post edit/delete + user content ------------------------------ */

export const UPDATE_POST_MUTATION = /* GraphQL */ `
  mutation UpdatePost($postId: ID!, $input: UpdatePostInput!) {
    updatePost(postId: $postId, input: $input) { ...PostFields }
  }
  ${POST_FRAGMENT}
`;

export const DELETE_POST_MUTATION = /* GraphQL */ `
  mutation DeletePost($postId: ID!) {
    deletePost(postId: $postId)
  }
`;

export const UPDATE_COMMENT_MUTATION = /* GraphQL */ `
  mutation UpdateComment($commentId: ID!, $body: String!) {
    updateComment(commentId: $commentId, body: $body) {
      id
      body
      createdAt
      author { ...PublicUserFields }
    }
  }
  ${PUBLIC_USER_FRAGMENT}
`;

export const DELETE_COMMENT_MUTATION = /* GraphQL */ `
  mutation DeleteComment($commentId: ID!) {
    deleteComment(commentId: $commentId)
  }
`;

export const USER_POSTS_QUERY = /* GraphQL */ `
  query UserPosts($username: String!, $after: String) {
    userPosts(username: $username, after: $after, first: 20) {
      nodes { ...PostFields }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${POST_FRAGMENT}
`;

export const USER_COMMENTS_QUERY = /* GraphQL */ `
  query UserComments($username: String!, $after: String) {
    userComments(username: $username, after: $after, first: 20) {
      id
      postId
      body
      createdAt
      author { ...PublicUserFields }
    }
  }
  ${PUBLIC_USER_FRAGMENT}
`;

export const MY_LIKED_POSTS_QUERY = /* GraphQL */ `
  query MyLikedPosts($after: String) {
    myLikedPosts(after: $after, first: 20) {
      nodes { ...PostFields }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${POST_FRAGMENT}
`;

export const MY_BOOKMARKED_POSTS_QUERY = /* GraphQL */ `
  query MyBookmarkedPosts($after: String) {
    myBookmarkedPosts(after: $after, first: 20) {
      nodes { ...PostFields }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${POST_FRAGMENT}
`;
