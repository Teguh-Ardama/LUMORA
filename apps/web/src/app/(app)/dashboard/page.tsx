"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Camera } from "lucide-react";
import { Button, Card, CardContent, ErrorState, Toolbar } from "@lumora/ui";
import { useAnalytics } from "@/lib/hooks/use-admin";
import { useMe } from "@/lib/hooks/use-auth";
import {
  CategoryBarChart,
  SessionsOverTimeChart,
  StatTile,
  StatTileSkeleton,
} from "@/components/analytics/charts";

export default function OverviewPage() {
  const { data: me } = useMe();
  const { data, isLoading, isError, refetch } = useAnalytics();
  const s = data?.summary;

  return (
    <div>
      <Toolbar
        title={`Welcome back${me ? `, ${me.user.name.split(" ")[0]}` : ""}`}
        description="Your organization at a glance."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/events">
                <CalendarDays /> Manage events
              </Link>
            </Button>
            <Button asChild>
              <Link href="/operator">
                <Camera /> Open Operator Console
              </Link>
            </Button>
          </>
        }
      />

      {isError ? (
        <ErrorState message="Could not load analytics." onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {isLoading || !s ? (
              Array.from({ length: 4 }).map((_, i) => <StatTileSkeleton key={i} />)
            ) : (
              <>
                <StatTile label="Events" value={String(s.totalEvents)} />
                <StatTile
                  label="Sessions"
                  value={String(s.totalSessions)}
                  hint={`${s.readySessions} composed`}
                />
                <StatTile label="Photos captured" value={String(s.totalPhotos)} />
                <StatTile
                  label="Deliveries sent"
                  value={String(s.totalDeliveries)}
                  hint={`${s.printedJobs}/${s.totalPrintJobs} prints done`}
                />
              </>
            )}
          </div>

          {s ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <SessionsOverTimeChart data={s.sessionsPerDay} />
              <CategoryBarChart
                title="Top filters"
                data={s.filterUsage.map((f) => ({ name: f.filterName, count: f.count }))}
              />
            </div>
          ) : null}

          <Card>
            <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium">Ready to run a booth?</p>
                <p className="text-sm text-muted-foreground">
                  Open the operator console, pick an event, and start the first session.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/operator">
                  Launch console <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
