'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/auth-store';
import { gql } from '@/lib/graphql-client';

const ANALYTICS_QUERY = /* GraphQL */ `
  query AnalyticsSummary {
    analyticsSummary {
      users
      posts
      communities
      studyMaterials
      openReports
      eventsLast7d
    }
    reports(status: OPEN) {
      id
      targetType
      targetId
      reason
      status
      createdAt
    }
  }
`;

const RESOLVE_REPORT = /* GraphQL */ `
  mutation Resolve($id: ID!, $resolution: String!, $status: ReportStatus!) {
    resolveReport(id: $id, resolution: $resolution, status: $status) { id status }
  }
`;
const REMOVE_POST = /* GraphQL */ `
  mutation Remove($postId: ID!) {
    removePost(postId: $postId) { id }
  }
`;
const BAN_USER = /* GraphQL */ `
  mutation Ban($userId: ID!, $reason: String!) {
    banUser(userId: $userId, reason: $reason) { id }
  }
`;

interface AnalyticsResp {
  analyticsSummary: {
    users: number;
    posts: number;
    communities: number;
    studyMaterials: number;
    openReports: number;
    eventsLast7d: number;
  };
  reports: Array<{
    id: string;
    targetType: 'POST' | 'COMMENT' | 'USER' | 'COMMUNITY';
    targetId: string;
    reason: string;
    status: string;
    createdAt: string;
  }>;
}

export default function AdminPage() {
  const viewer = useAuthStore((s) => s.viewer);
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (viewer && viewer.role !== 'ADMIN') router.replace('/feed');
  }, [viewer, router]);

  const q = useQuery({
    queryKey: ['admin', 'summary'],
    enabled: viewer?.role === 'ADMIN',
    queryFn: () => gql<AnalyticsResp>(ANALYTICS_QUERY),
  });

  if (viewer?.role !== 'ADMIN') return null;

  async function resolve(id: string, status: 'RESOLVED' | 'DISMISSED') {
    await gql(RESOLVE_REPORT, { id, status, resolution: status });
    qc.invalidateQueries({ queryKey: ['admin', 'summary'] });
  }
  async function takeAction(report: AnalyticsResp['reports'][number]) {
    if (report.targetType === 'POST') {
      await gql(REMOVE_POST, { postId: report.targetId });
    } else if (report.targetType === 'USER') {
      await gql(BAN_USER, { userId: report.targetId, reason: report.reason });
    }
    await resolve(report.id, 'RESOLVED');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {q.data ? (
          <>
            <Metric label="Users" value={q.data.analyticsSummary.users} />
            <Metric label="Posts" value={q.data.analyticsSummary.posts} />
            <Metric label="Communities" value={q.data.analyticsSummary.communities} />
            <Metric label="Study materials" value={q.data.analyticsSummary.studyMaterials} />
            <Metric label="Open reports" value={q.data.analyticsSummary.openReports} />
            <Metric label="Events (7d)" value={q.data.analyticsSummary.eventsLast7d} />
          </>
        ) : null}
      </div>

      <h2 className="mt-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
        Open reports
      </h2>
      <div className="flex flex-col gap-2">
        {(q.data?.reports ?? []).length === 0 ? (
          <Card className="text-center text-[var(--color-fg-muted)]">All clear ✨</Card>
        ) : (
          q.data?.reports.map((r) => (
            <Card key={r.id} className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge tone="warn">{r.targetType}</Badge>
                  <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                    {r.targetId}
                  </span>
                </div>
                <p className="mt-1 text-sm">{r.reason}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="danger" onClick={() => takeAction(r)}>
                  Resolve + take action
                </Button>
                <Button size="sm" variant="ghost" onClick={() => resolve(r.id, 'DISMISSED')}>
                  Dismiss
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="text-xs text-[var(--color-fg-muted)]">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value.toLocaleString()}</div>
    </Card>
  );
}
