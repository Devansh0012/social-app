'use client';

import { GraphQLClient, type Variables } from 'graphql-request';
import { env } from './env';
import { useAuthStore } from './auth-store';

interface RefreshResponse {
  refresh: {
    viewer: import('./auth-store').Viewer;
    tokens: {
      accessToken: string;
      refreshToken: string;
      accessExpiresIn: number;
      refreshExpiresIn: number;
    };
  };
}

const REFRESH_MUTATION = /* GraphQL */ `
  mutation Refresh($refreshToken: String!) {
    refresh(refreshToken: $refreshToken) {
      viewer {
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
      tokens {
        accessToken
        refreshToken
        accessExpiresIn
        refreshExpiresIn
      }
    }
  }
`;

const baseClient = new GraphQLClient(env.graphqlUrl);

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const { refreshToken, setSession, clear } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const data = await baseClient.request<RefreshResponse>(REFRESH_MUTATION, { refreshToken });
    setSession({
      viewer: data.refresh.viewer,
      accessToken: data.refresh.tokens.accessToken,
      refreshToken: data.refresh.tokens.refreshToken,
    });
    return data.refresh.tokens.accessToken;
  } catch {
    clear();
    return null;
  }
}

export async function gql<T = unknown>(
  query: string,
  variables?: Variables,
  options: { withAuth?: boolean } = { withAuth: true },
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {};
  if (options.withAuth !== false && accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }
  try {
    return await baseClient.request<T>({ document: query, variables, requestHeaders: headers });
  } catch (err) {
    const isUnauthenticated = (err as { response?: { errors?: Array<{ extensions?: { code?: string } }> } })
      ?.response?.errors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED');
    if (!isUnauthenticated || options.withAuth === false) throw err;

    refreshPromise ??= tryRefresh().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;
    if (!newToken) throw err;
    return baseClient.request<T>({
      document: query,
      variables,
      requestHeaders: { authorization: `Bearer ${newToken}` },
    });
  }
}
