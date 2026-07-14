"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Camera } from "lucide-react";
import { format } from "date-fns";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  LoadingState,
  Toolbar,
} from "@lumora/ui";
import { useOperatorEvents } from "@/lib/hooks/use-operator";

export default function OperatorEventPicker() {
  const { data, isLoading, isError, refetch } = useOperatorEvents();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Toolbar
        title="Operator Console"
        description="Pick the event you are operating today."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingState label="Loading your events…" />
      ) : (data?.events.length ?? 0) === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No active events assigned to you"
          description="Ask an admin to assign you as an operator on an active event."
        />
      ) : (
        <div className="space-y-3">
          {data!.events.map((e) => (
            <Card key={e.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="font-medium">{e.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.venue ? `${e.venue} · ` : ""}
                      {format(new Date(e.startsAt), "d MMM yyyy")}
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <Link href={`/operator/${e.id}`}>
                    Open <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
