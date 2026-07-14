"use client";

import { ErrorState, LoadingState, Toolbar } from "@lumora/ui";
import { useAnalytics } from "@/lib/hooks/use-admin";
import {
  CategoryBarChart,
  SessionsOverTimeChart,
  StatTile,
} from "@/components/analytics/charts";

export default function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useAnalytics();
  const s = data?.summary;

  return (
    <div>
      <Toolbar title="Analytics" description="Session, delivery, and print performance across your organization." />
      {isError ? (
        <ErrorState message="Could not load analytics." onRetry={() => refetch()} />
      ) : isLoading || !s ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Total sessions" value={String(s.totalSessions)} />
            <StatTile
              label="Compose success"
              value={
                s.totalSessions > 0
                  ? `${Math.round((s.readySessions / Math.max(1, s.readySessions + s.failedSessions)) * 100)}%`
                  : "—"
              }
              hint={`${s.failedSessions} failed`}
            />
            <StatTile
              label="Avg compose time"
              value={s.avgComposeMs ? `${(s.avgComposeMs / 1000).toFixed(1)}s` : "—"}
            />
            <StatTile
              label="Prints completed"
              value={`${s.printedJobs}/${s.totalPrintJobs}`}
            />
          </div>

          <SessionsOverTimeChart data={s.sessionsPerDay} />

          <div className="grid gap-6 lg:grid-cols-2">
            <CategoryBarChart
              title="Deliveries by channel"
              data={Object.entries(s.deliveriesByChannel).map(([name, count]) => ({ name, count }))}
            />
            <CategoryBarChart
              title="Filter usage"
              data={s.filterUsage.map((f) => ({ name: f.filterName, count: f.count }))}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <CategoryBarChart
              title="Capture source"
              data={Object.entries(s.captureSourceSplit).map(([name, count]) => ({ name, count }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
